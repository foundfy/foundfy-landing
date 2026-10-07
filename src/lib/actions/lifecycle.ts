import {
  findDecisionById,
  findDecisionRunById,
  findLatestCompletedDecisionRun,
} from "@/lib/decisions/db";
import { staleReasonForRun, toDecisionView } from "@/lib/decisions/load";
import { loadDecisionPrerequisites } from "@/lib/decisions/generate";
import {
  DUPLICATE_TITLE_RULE_KEY,
  META_DESCRIPTION_ACTION_TYPE,
  MISSING_TITLE_RULE_KEY,
  PAGE_TITLE_ACTION_TYPE,
  SUPPORTED_ACTION_RULE_KEY,
  supportedActionField,
  supportedActionTypeForDecision,
} from "@/lib/decisions/supported-action";
import type { DecisionRecord, DecisionRunRecord, GoalSnapshot } from "@/lib/decisions/types";
import { requireObserveOwner } from "@/lib/gsc/observe";
import { getWebsiteById } from "@/lib/websites/repository";
import {
  ADAPTER_NOT_CONNECTED,
  CANCELLABLE_ACTION_STATUSES,
  EDITABLE_ACTION_STATUSES,
} from "./config";
import {
  countActionAttempts,
  findActionAttemptByIdempotencyKey,
  findActionById,
  findObservationSnapshot,
  findOpenActionForDecision,
  findPageSnapshot,
  findSuccessfulGithubExecuteAttempt,
  insertAction,
  insertActionAttempt,
  listVisibleActionsForWebsite,
  updateAction,
  type ActionObservationSnapshot,
  type ActionPageSnapshot,
} from "./db";
import { commitHomepageDescription } from "./github/commit";
import { FOUNDFY_GITHUB_PROVIDER, githubExecuteIdempotencyKey, readGitHubAppConfig } from "./github/config";
import { isFoundfyHomepageMetaTarget } from "./github/target";
import { fetchLiveHomepageMeta, observeHomepageDeployment } from "./live-meta";
import { metaValuesEqual } from "./meta";
import { executeAvailability, toActionPreview } from "./preview";
import { buildMutationSpec, normalizeProposedValue, statusAfterProposedValue } from "./mutation";
import {
  freezeTitleGroupEvidence,
  otherDuplicateMemberUrls,
  sharedTitleFromEvidence,
  titlePrimaryPage,
} from "./title-group";
import { normalizeTitle, titleValuesEqual } from "./title";
import { ActionError, type ActionPreviewView, type ActionRecord } from "./types";
import { verificationViewFor } from "./verify";
import { learningViewFor } from "./learn";

function isEmptyMeta(value: string | null | undefined): boolean {
  return !value?.trim();
}

function evidenceString(evidence: Record<string, unknown>, key: string): string | null {
  const value = evidence[key];
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return null;
  }
  return String(value);
}

function observationSupportsMissingMeta(
  observation: ActionObservationSnapshot | null,
  pageId: string,
): boolean {
  if (!observation || observation.status !== "active") {
    return false;
  }

  if (observation.ruleKey !== SUPPORTED_ACTION_RULE_KEY) {
    return false;
  }

  if (observation.pageId !== pageId) {
    return false;
  }

  return isEmptyMeta(evidenceString(observation.evidence, "metaDescription"));
}

function observationSupportsTitle(
  observation: ActionObservationSnapshot,
  page: ActionPageSnapshot,
): boolean {
  if (observation.status !== "active" || observation.pageId !== page.id) {
    return false;
  }

  if (observation.ruleKey === MISSING_TITLE_RULE_KEY) {
    return titleValuesEqual(page.title, null) && titleValuesEqual(evidenceString(observation.evidence, "title"), null);
  }

  if (observation.ruleKey === DUPLICATE_TITLE_RULE_KEY) {
    const observedTitle = evidenceString(observation.evidence, "title");
    return (
      !titleValuesEqual(page.title, null) &&
      titleValuesEqual(page.title, observedTitle)
    );
  }

  return false;
}

async function loadCurrentRun(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<{
  ownerId: string;
  run: DecisionRunRecord | null;
  goal: GoalSnapshot;
  staleReason: string | null;
}> {
  const prerequisites = await loadDecisionPrerequisites(input);
  const run = await findLatestCompletedDecisionRun(input.websiteId);
  if (!run) {
    return {
      ownerId: prerequisites.context.owner.id,
      run: null,
      goal: prerequisites.goal,
      staleReason: "missing_run",
    };
  }

  return {
    ownerId: prerequisites.context.owner.id,
    run,
    goal: run.goalSnapshot,
    staleReason: staleReasonForRun({
      run,
      siteModelId: prerequisites.siteModel.id,
      crawlRunId: prerequisites.crawl.id,
      gscSearchSyncId: prerequisites.sync.id,
      goal: prerequisites.goal,
    }),
  };
}

async function requireCurrentDecisionContext(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<{
  ownerId: string;
  run: DecisionRunRecord;
  goal: GoalSnapshot;
}> {
  const loaded = await loadCurrentRun(input);
  if (!loaded.run || loaded.staleReason) {
    throw new ActionError(
      "decision_stale",
      loaded.run
        ? "This Decision is no longer current. Refresh priorities before preparing a change."
        : "Prioritize actions before preparing a change.",
    );
  }

  return {
    ownerId: loaded.ownerId,
    run: loaded.run,
    goal: loaded.goal,
  };
}

async function blockIfUnsafe(action: ActionRecord, run: DecisionRunRecord | null): Promise<boolean> {
  if (!run || !provenanceStillMatches(action, run) || !(await frozenBeforeStillHolds(action))) {
    await blockAction(action);
    return true;
  }

  return false;
}

function provenanceStillMatches(action: ActionRecord, run: DecisionRunRecord): boolean {
  return (
    action.decisionRunId === run.id &&
    action.crawlRunId === run.crawlRunId &&
    action.gscSyncId === run.gscSearchSyncId &&
    action.siteModelId === run.siteModelId &&
    action.goalId === run.goalId
  );
}

async function frozenBeforeStillHolds(action: ActionRecord): Promise<boolean> {
  const page = await findPageSnapshot(action.targetPageId);
  if (!page || page.crawlRunId !== action.crawlRunId) {
    return false;
  }

  if (action.field === "title") {
    return (
      titleValuesEqual(page.title, action.mutationSpec.before) &&
      titleValuesEqual(action.observedBefore, action.mutationSpec.before)
    );
  }

  return (
    metaValuesEqual(page.metaDescription, action.mutationSpec.before) &&
    metaValuesEqual(action.observedBefore, action.mutationSpec.before)
  );
}

function actionIsUnsafe(action: ActionRecord, run: DecisionRunRecord | null, staleReason: string | null): boolean {
  if (!run || staleReason || !provenanceStillMatches(action, run)) {
    return true;
  }

  return false;
}

async function blockAction(action: ActionRecord): Promise<ActionRecord> {
  const updated = await updateAction({
    id: action.id,
    websiteId: action.websiteId,
    expectedStatuses: [action.status],
    patch: { status: "blocked" },
  });

  return updated ?? { ...action, status: "blocked" };
}

async function loadSupportedDecision(input: {
  websiteId: string;
  decisionId: string;
  runId: string;
}): Promise<DecisionRecord> {
  const decision = await findDecisionById(input.websiteId, input.decisionId);
  if (!decision) {
    throw new ActionError("decision_not_found", "Decision not found.", 404);
  }

  if (decision.decisionRunId !== input.runId) {
    throw new ActionError(
      "decision_stale",
      "This Decision is no longer current. Refresh priorities before preparing a change.",
    );
  }

  if (!supportedActionTypeForDecision(decision)) {
    throw new ActionError(
      "unsupported_decision",
      "Foundfy can only prepare a change from a current supported missing-meta or page-title Decision.",
    );
  }

  if (!decision.pageId || !decision.pageUrl) {
    throw new ActionError("missing_page", "This Decision does not have a current mapped page.");
  }

  return decision;
}

async function requireCurrentMappedPage(input: {
  pageId: string;
  crawlRunId: string;
}): Promise<ActionPageSnapshot> {
  const page = await findPageSnapshot(input.pageId);
  if (!page || page.crawlRunId !== input.crawlRunId) {
    throw new ActionError("missing_page", "The current mapped page is no longer available.");
  }

  return page;
}

async function requireMatchingPage(input: {
  pageId: string;
  crawlRunId: string;
}): Promise<ActionPageSnapshot> {
  const page = await requireCurrentMappedPage(input);
  if (!isEmptyMeta(page.metaDescription)) {
    throw new ActionError(
      "observation_no_longer_supports",
      "This page already has a meta description.",
    );
  }

  return page;
}

async function loadDecisionObservations(
  decision: DecisionRecord,
): Promise<ActionObservationSnapshot[]> {
  const observations: ActionObservationSnapshot[] = [];
  for (const ref of decision.evidenceRefs.filter((item) => item.kind === "observation")) {
    const observation = await findObservationSnapshot(ref.recordId);
    if (observation) {
      observations.push(observation);
    }
  }
  return observations;
}

async function requireSupportingObservation(
  decision: DecisionRecord,
  page: ActionPageSnapshot,
): Promise<ActionObservationSnapshot[]> {
  const observations = await loadDecisionObservations(decision);
  const actionType = supportedActionTypeForDecision(decision);

  if (actionType === META_DESCRIPTION_ACTION_TYPE) {
    if (!observations.some((observation) => observationSupportsMissingMeta(observation, page.id))) {
      throw new ActionError(
        "observation_no_longer_supports",
        "Current observation evidence no longer supports a missing meta description change.",
      );
    }
    return observations;
  }

  if (actionType === PAGE_TITLE_ACTION_TYPE) {
    if (!observations.some((observation) => observationSupportsTitle(observation, page))) {
      throw new ActionError(
        "observation_no_longer_supports",
        "Current observation evidence no longer supports a page title change.",
      );
    }
    return observations;
  }

  throw new ActionError(
    "unsupported_decision",
    "Foundfy can only prepare a change from a current supported missing-meta or page-title Decision.",
  );
}

async function adapterReadyFor(action: ActionRecord, hostname: string | null): Promise<boolean> {
  if (!hostname || !action.proposedValue || !readGitHubAppConfig()) {
    return false;
  }

  return isFoundfyHomepageMetaTarget({
    hostname,
    pageUrl: action.targetPageUrl,
    field: action.field,
    actionType: action.actionType,
  });
}

async function previewForWithGoal(
  action: ActionRecord,
  goal: GoalSnapshot,
  truncated: boolean,
  safety: { run: DecisionRunRecord | null; staleReason: string | null; hostname: string | null },
): Promise<ActionPreviewView> {
  const decision = action.decisionId
    ? await findDecisionById(action.websiteId, action.decisionId)
    : null;
  const view = decision ? toDecisionView(decision, goal, truncated) : null;
  const frozenUnsafe = safety.run ? !(await frozenBeforeStillHolds(action)) : true;
  const unsafe = actionIsUnsafe(action, safety.run, safety.staleReason) || frozenUnsafe;
  const availability = executeAvailability({
    status: action.status,
    unsafe,
    adapterReady: await adapterReadyFor(action, safety.hostname),
  });

  return toActionPreview({
    action,
    decision: view
      ? {
          id: view.id,
          title: view.title,
          explanation: view.explanation,
          why: view.why,
        }
      : {
          id: action.decisionId ?? action.id,
          title: action.targetPageUrl,
          explanation: "",
          why: {
            searchDemand: null,
            websiteEvidence: "",
            goalContext: "",
            evidencePeriod: null,
            matchingConfidence: "",
            truncated: false,
          },
        },
    ...availability,
    verification: await verificationViewFor(action),
    learning: await learningViewFor(action),
  });
}

async function previewFor(
  action: ActionRecord,
  sessionToken: string | null,
): Promise<ActionPreviewView> {
  const loaded = await loadCurrentRun({ websiteId: action.websiteId, sessionToken });
  const website = await getWebsiteById(action.websiteId);
  const historical =
    action.status === "executed" || action.status === "blocked" || action.status === "cancelled";
  const run = action.decisionRunId
    ? await findDecisionRunById(action.websiteId, action.decisionRunId)
    : null;
  if (!run && !historical) {
    throw new ActionError("decision_stale", "This Decision is no longer current.");
  }

  return previewForWithGoal(
    action,
    run?.goalSnapshot ?? {
      id: action.goalId,
      primaryType: "grow_signups",
      secondaryType: null,
      note: null,
      updatedAt: action.createdAt,
    },
    run?.gscTruncated ?? false,
    {
      run: loaded.staleReason ? null : loaded.run,
      staleReason: loaded.staleReason,
      hostname: website?.hostname ?? null,
    },
  );
}

export async function prepareAction(input: {
  websiteId: string;
  sessionToken: string | null;
  decisionId: string;
}): Promise<ActionPreviewView> {
  const context = await requireCurrentDecisionContext(input);
  const existing = await findOpenActionForDecision({
    websiteId: input.websiteId,
    decisionId: input.decisionId,
  });
  const website = await getWebsiteById(input.websiteId);
  const safety = {
    run: context.run,
    staleReason: null,
    hostname: website?.hostname ?? null,
  };
  if (existing) {
    return previewForWithGoal(existing, context.goal, context.run.gscTruncated, safety);
  }

  const decision = await loadSupportedDecision({
    websiteId: input.websiteId,
    decisionId: input.decisionId,
    runId: context.run.id,
  });
  const actionType = supportedActionTypeForDecision(decision);
  if (!actionType) {
    throw new ActionError(
      "unsupported_decision",
      "Foundfy can only prepare a change from a current supported missing-meta or page-title Decision.",
    );
  }
  const primary = titlePrimaryPage(decision);
  if (!primary) {
    throw new ActionError("missing_page", "This Decision does not have a current mapped page.");
  }
  const page =
    actionType === META_DESCRIPTION_ACTION_TYPE
      ? await requireMatchingPage({
          pageId: primary.pageId,
          crawlRunId: context.run.crawlRunId,
        })
      : await requireCurrentMappedPage({
          pageId: primary.pageId,
          crawlRunId: context.run.crawlRunId,
        });
  const observations = await requireSupportingObservation(decision, page);
  const field = supportedActionField(actionType);
  const observedBefore =
    actionType === PAGE_TITLE_ACTION_TYPE ? normalizeTitle(page.title) : null;
  const otherMemberUrls =
    actionType === PAGE_TITLE_ACTION_TYPE
      ? otherDuplicateMemberUrls({
          targetUrl: primary.pageUrl,
          observations,
          evidenceRefs: decision.evidenceRefs,
        })
      : [];
  const sharedTitle =
    actionType === PAGE_TITLE_ACTION_TYPE
      ? sharedTitleFromEvidence(observations, observedBefore)
      : null;
  const evidenceRefs =
    actionType === PAGE_TITLE_ACTION_TYPE
      ? freezeTitleGroupEvidence({
          evidenceRefs: decision.evidenceRefs,
          targetPageId: page.id,
          targetUrl: primary.pageUrl,
          sharedTitle,
          otherMemberUrls,
          group: otherMemberUrls.length > 0,
        })
      : decision.evidenceRefs;

  try {
    const action = await insertAction({
      websiteId: input.websiteId,
      decisionId: decision.id,
      decisionRunId: context.run.id,
      ownerId: context.ownerId,
      actionType,
      targetPageId: page.id,
      targetPageUrl: primary.pageUrl,
      field,
      observedBefore,
      proposedValue: null,
      mutationSpec: buildMutationSpec({
        targetUrl: primary.pageUrl,
        field,
        before: observedBefore,
        proposedValue: null,
      }),
      pageContentHashAtPrepare: page.contentHash,
      crawlRunId: context.run.crawlRunId,
      gscSyncId: context.run.gscSearchSyncId,
      siteModelId: context.run.siteModelId,
      goalId: context.run.goalId,
      evidenceRefs,
    });
    return previewForWithGoal(action, context.goal, context.run.gscTruncated, safety);
  } catch (error) {
    const raced = await findOpenActionForDecision({
      websiteId: input.websiteId,
      decisionId: input.decisionId,
    });
    if (raced) {
      return previewForWithGoal(raced, context.goal, context.run.gscTruncated, safety);
    }
    throw error;
  }
}

export async function listActionsForWebsite(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<{ actions: ActionPreviewView[] }> {
  const loaded = await loadCurrentRun(input);
  const website = await getWebsiteById(input.websiteId);
  const actions = await listVisibleActionsForWebsite(input.websiteId);
  const previews: ActionPreviewView[] = [];
  for (const action of actions) {
    const storedRun = action.decisionRunId
      ? await findDecisionRunById(action.websiteId, action.decisionRunId)
      : null;
    const historical =
      action.status === "executed" || action.status === "blocked" || action.status === "cancelled";
    if (!storedRun && !historical) {
      continue;
    }
    previews.push(
      await previewForWithGoal(
        action,
        storedRun?.goalSnapshot ?? {
          id: action.goalId,
          primaryType: "grow_signups",
          secondaryType: null,
          note: null,
          updatedAt: action.createdAt,
        },
        storedRun?.gscTruncated ?? false,
        {
          run: loaded.staleReason ? null : loaded.run,
          staleReason: loaded.staleReason,
          hostname: website?.hostname ?? null,
        },
      ),
    );
  }
  return { actions: previews };
}

export async function getActionPreview(input: {
  websiteId: string;
  sessionToken: string | null;
  actionId: string;
}): Promise<ActionPreviewView> {
  await requireObserveOwner(input);
  const action = await findActionById({
    websiteId: input.websiteId,
    actionId: input.actionId,
  });
  if (!action) {
    throw new ActionError("action_not_found", "Action not found.", 404);
  }

  return previewFor(action, input.sessionToken);
}

export async function updateActionProposal(input: {
  websiteId: string;
  sessionToken: string | null;
  actionId: string;
  proposedValue: unknown;
}): Promise<ActionPreviewView> {
  const loaded = await loadCurrentRun(input);
  const action = await findActionById({
    websiteId: input.websiteId,
    actionId: input.actionId,
  });
  if (!action) {
    throw new ActionError("action_not_found", "Action not found.", 404);
  }

  if (!EDITABLE_ACTION_STATUSES.includes(action.status as (typeof EDITABLE_ACTION_STATUSES)[number])) {
    throw new ActionError("not_editable", "Approved changes cannot be edited.");
  }

  if (await blockIfUnsafe(action, loaded.staleReason ? null : loaded.run)) {
    throw new ActionError(
      "decision_stale",
      "This Decision is no longer current. Refresh priorities before preparing a change.",
    );
  }

  const proposedValue = normalizeProposedValue(input.proposedValue, action.field);
  const updated = await updateAction({
    id: action.id,
    websiteId: input.websiteId,
    expectedStatuses: [...EDITABLE_ACTION_STATUSES],
    patch: {
      proposedValue,
      mutationSpec: buildMutationSpec({
        targetUrl: action.targetPageUrl,
        field: action.field,
        before: action.mutationSpec.before,
        proposedValue,
      }),
      status: statusAfterProposedValue(proposedValue),
    },
  });

  if (!updated) {
    throw new ActionError("not_editable", "Approved changes cannot be edited.");
  }

  const website = await getWebsiteById(input.websiteId);
  return previewForWithGoal(updated, loaded.goal, loaded.run?.gscTruncated ?? false, {
    run: loaded.staleReason ? null : loaded.run,
    staleReason: loaded.staleReason,
    hostname: website?.hostname ?? null,
  });
}

export async function approveAction(input: {
  websiteId: string;
  sessionToken: string | null;
  actionId: string;
}): Promise<ActionPreviewView> {
  const loaded = await loadCurrentRun(input);
  const action = await findActionById({
    websiteId: input.websiteId,
    actionId: input.actionId,
  });
  if (!action) {
    throw new ActionError("action_not_found", "Action not found.", 404);
  }

  if (!EDITABLE_ACTION_STATUSES.includes(action.status as (typeof EDITABLE_ACTION_STATUSES)[number])) {
    throw new ActionError("not_editable", "This change can no longer be approved.");
  }

  if (!action.proposedValue) {
    throw new ActionError(
      "empty_proposed_value",
      action.field === "title"
        ? "Enter a page title before approving this change."
        : "Enter a meta description before approving this change.",
      400,
    );
  }

  if (await blockIfUnsafe(action, loaded.staleReason ? null : loaded.run)) {
    throw new ActionError(
      "decision_stale",
      "This Decision is no longer current. Refresh priorities before approving this change.",
    );
  }

  const currentRun = loaded.run;
  if (!currentRun) {
    throw new ActionError("decision_stale", "This Decision is no longer current.");
  }
  if (!action.decisionId) {
    throw new ActionError("decision_not_found", "Decision not found.", 404);
  }

  await loadSupportedDecision({
    websiteId: input.websiteId,
    decisionId: action.decisionId,
    runId: currentRun.id,
  });
  if (action.field === "title") {
    const page = await requireCurrentMappedPage({
      pageId: action.targetPageId,
      crawlRunId: currentRun.crawlRunId,
    });
    if (!titleValuesEqual(page.title, action.mutationSpec.before)) {
      await blockAction(action);
      throw new ActionError(
        "before_state_changed",
        "The current page title no longer matches the prepared before-state.",
      );
    }
  } else {
    await requireMatchingPage({
      pageId: action.targetPageId,
      crawlRunId: currentRun.crawlRunId,
    });
  }

  const approved = await updateAction({
    id: action.id,
    websiteId: input.websiteId,
    expectedStatuses: [...EDITABLE_ACTION_STATUSES],
    patch: {
      status: "approved",
      approvedByOwnerId: loaded.ownerId,
      approvedAt: new Date().toISOString(),
    },
  });

  if (!approved) {
    throw new ActionError("not_editable", "This change can no longer be approved.");
  }

  const website = await getWebsiteById(input.websiteId);
  return previewForWithGoal(approved, loaded.goal, currentRun.gscTruncated, {
    run: currentRun,
    staleReason: null,
    hostname: website?.hostname ?? null,
  });
}

export async function cancelAction(input: {
  websiteId: string;
  sessionToken: string | null;
  actionId: string;
}): Promise<ActionPreviewView> {
  await requireObserveOwner(input);
  const action = await findActionById({
    websiteId: input.websiteId,
    actionId: input.actionId,
  });
  if (!action) {
    throw new ActionError("action_not_found", "Action not found.", 404);
  }

  if (!CANCELLABLE_ACTION_STATUSES.includes(action.status as (typeof CANCELLABLE_ACTION_STATUSES)[number])) {
    throw new ActionError("not_cancellable", "This change can no longer be cancelled.");
  }

  const cancelled = await updateAction({
    id: action.id,
    websiteId: input.websiteId,
    expectedStatuses: [...CANCELLABLE_ACTION_STATUSES],
    patch: { status: "cancelled" },
  });

  if (!cancelled) {
    throw new ActionError("not_cancellable", "This change can no longer be cancelled.");
  }

  return previewFor(cancelled, input.sessionToken);
}

export async function executeAction(input: {
  websiteId: string;
  sessionToken: string | null;
  actionId: string;
}): Promise<ActionPreviewView> {
  const loaded = await loadCurrentRun(input);
  const action = await findActionById({
    websiteId: input.websiteId,
    actionId: input.actionId,
  });
  if (!action) {
    throw new ActionError("action_not_found", "Action not found.", 404);
  }

  if (action.status === "executed") {
    return previewFor(action, input.sessionToken);
  }

  if (action.status !== "approved") {
    throw new ActionError("not_approved", "Approve this change before execution.");
  }

  if (await blockIfUnsafe(action, loaded.staleReason ? null : loaded.run)) {
    throw new ActionError(
      "decision_stale",
      "This Decision is no longer current. Refresh priorities before execution.",
    );
  }

  const website = await getWebsiteById(input.websiteId);
  if (action.actionType === PAGE_TITLE_ACTION_TYPE || action.field === "title") {
    const attemptNumber = (await countActionAttempts(action.id)) + 1;
    await insertActionAttempt({
      actionId: action.id,
      attemptNumber,
      idempotencyKey: `${action.id}:execute:${attemptNumber}`,
      provider: null,
      result: "failure",
      errorCode: ADAPTER_NOT_CONNECTED,
    });
    throw new ActionError(
      "adapter_not_connected",
      "Foundfy cannot apply this change until a site connection exists.",
    );
  }

  const supported = Boolean(
    website &&
      isFoundfyHomepageMetaTarget({
        hostname: website.hostname,
        pageUrl: action.targetPageUrl,
        field: action.field,
        actionType: action.actionType,
      }),
  );
  const githubConfig = readGitHubAppConfig();
  if (!supported || !githubConfig) {
    const attemptNumber = (await countActionAttempts(action.id)) + 1;
    await insertActionAttempt({
      actionId: action.id,
      attemptNumber,
      idempotencyKey: `${action.id}:execute:${attemptNumber}`,
      provider: null,
      result: "failure",
      errorCode: ADAPTER_NOT_CONNECTED,
    });
    throw new ActionError(
      "adapter_not_connected",
      "Foundfy cannot apply this change until a site connection exists.",
    );
  }

  if (!action.proposedValue) {
    throw new ActionError("empty_proposed_value", "Enter a meta description before approving this change.", 400);
  }

  const successKey = githubExecuteIdempotencyKey(action.id);
  const existingSuccess =
    (await findActionAttemptByIdempotencyKey(successKey)) ??
    (await findSuccessfulGithubExecuteAttempt(action.id));
  if (existingSuccess?.result === "success") {
    const executed =
      (await updateAction({
        id: action.id,
        websiteId: action.websiteId,
        expectedStatuses: ["approved", "executed"],
        patch: { status: "executed" },
      })) ?? { ...action, status: "executed" as const };
    return previewFor(executed, input.sessionToken);
  }

  try {
    const liveMeta = await fetchLiveHomepageMeta();
    const liveMatchesBefore = metaValuesEqual(liveMeta, action.mutationSpec.before);
    const liveMatchesAfter = metaValuesEqual(liveMeta, action.proposedValue);

    if (!liveMatchesBefore && !liveMatchesAfter) {
      throw new ActionError(
        "before_state_changed",
        "The live homepage meta description no longer matches the approved before-state.",
      );
    }

    const artifact = await commitHomepageDescription({
      config: githubConfig,
      actionId: action.id,
      expectedBefore: action.mutationSpec.before,
      afterValue: action.proposedValue,
      recoverOnly: liveMatchesAfter && !liveMatchesBefore,
    });

    const observation = await observeHomepageDeployment({
      expected: action.proposedValue,
    });

    await insertActionAttempt({
      actionId: action.id,
      attemptNumber: (await countActionAttempts(action.id)) + 1,
      idempotencyKey: successKey,
      provider: FOUNDFY_GITHUB_PROVIDER,
      result: "success",
      errorCode: null,
      artifact: {
        ...artifact,
        deploymentObserved: observation.observed,
        deploymentObservedAt: observation.observedAt,
      },
    });

    const executed = await updateAction({
      id: action.id,
      websiteId: action.websiteId,
      expectedStatuses: ["approved"],
      patch: { status: "executed" },
    });
    return previewFor(executed ?? { ...action, status: "executed" }, input.sessionToken);
  } catch (error) {
    if (error instanceof ActionError && error.code === "before_state_changed") {
      await blockAction(action);
      throw error;
    }

    if (error instanceof ActionError && error.code === "decision_stale") {
      throw error;
    }

    if (
      error instanceof ActionError &&
      (error.code === "git_concurrency_conflict" ||
        error.code === "unexpected_source_shape" ||
        error.code === "remote_state_changed" ||
        error.code === "github_auth_failed")
    ) {
      await insertActionAttempt({
        actionId: action.id,
        attemptNumber: (await countActionAttempts(action.id)) + 1,
        idempotencyKey: `${action.id}:github:execute:fail:${Date.now()}`,
        provider: FOUNDFY_GITHUB_PROVIDER,
        result: "failure",
        errorCode: error.code,
      });
      throw error;
    }

    await insertActionAttempt({
      actionId: action.id,
      attemptNumber: (await countActionAttempts(action.id)) + 1,
      idempotencyKey: `${action.id}:github:execute:fail:${Date.now()}`,
      provider: FOUNDFY_GITHUB_PROVIDER,
      result: "failure",
      errorCode: error instanceof ActionError ? error.code : "github_auth_failed",
    });
    throw error instanceof ActionError
      ? error
      : new ActionError("github_auth_failed", "Foundfy could not apply this change to GitHub.");
  }
}
