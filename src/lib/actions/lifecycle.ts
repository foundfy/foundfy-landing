import {
  findDecisionById,
  findDecisionRunById,
  findLatestCompletedDecisionRun,
} from "@/lib/decisions/db";
import { staleReasonForRun, toDecisionView } from "@/lib/decisions/load";
import { loadDecisionPrerequisites } from "@/lib/decisions/generate";
import { supportedActionTypeForDecision, SUPPORTED_ACTION_RULE_KEY } from "@/lib/decisions/supported-action";
import type { DecisionRecord, DecisionRunRecord, GoalSnapshot } from "@/lib/decisions/types";
import { requireObserveOwner } from "@/lib/gsc/observe";
import {
  ADAPTER_NOT_CONNECTED,
  CANCELLABLE_ACTION_STATUSES,
  EDITABLE_ACTION_STATUSES,
} from "./config";
import {
  countActionAttempts,
  findActionById,
  findObservationSnapshot,
  findOpenActionForDecision,
  findPageSnapshot,
  insertAction,
  insertActionAttempt,
  listVisibleActionsForWebsite,
  updateAction,
  type ActionObservationSnapshot,
  type ActionPageSnapshot,
} from "./db";
import { toActionPreview } from "./preview";
import { buildMutationSpec, normalizeProposedMetaDescription, statusAfterProposedValue } from "./mutation";
import { ActionError, type ActionPreviewView, type ActionRecord } from "./types";

function isEmptyMeta(value: string | null | undefined): boolean {
  return !value?.trim();
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

  const evidenceMeta =
    typeof observation.evidence.metaDescription === "string"
      ? observation.evidence.metaDescription
      : observation.evidence.metaDescription == null
        ? null
        : String(observation.evidence.metaDescription);

  return isEmptyMeta(evidenceMeta);
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
      "Foundfy can only prepare a meta description change from a current missing-meta Type A Decision.",
    );
  }

  if (!decision.pageId || !decision.pageUrl) {
    throw new ActionError("missing_page", "This Decision does not have a current mapped page.");
  }

  return decision;
}

async function requireMatchingPage(input: {
  pageId: string;
  crawlRunId: string;
}): Promise<ActionPageSnapshot> {
  const page = await findPageSnapshot(input.pageId);
  if (!page || page.crawlRunId !== input.crawlRunId) {
    throw new ActionError("missing_page", "The current mapped page is no longer available.");
  }

  if (!isEmptyMeta(page.metaDescription)) {
    throw new ActionError(
      "observation_no_longer_supports",
      "This page already has a meta description.",
    );
  }

  return page;
}

async function requireSupportingObservation(decision: DecisionRecord, pageId: string): Promise<void> {
  const observationRef = decision.evidenceRefs.find((ref) => ref.kind === "observation");
  if (!observationRef) {
    throw new ActionError(
      "observation_no_longer_supports",
      "This Decision no longer has missing-meta observation evidence.",
    );
  }

  const observation = await findObservationSnapshot(observationRef.recordId);
  if (!observationSupportsMissingMeta(observation, pageId)) {
    throw new ActionError(
      "observation_no_longer_supports",
      "Current observation evidence no longer supports a missing meta description change.",
    );
  }
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

  if ((page.contentHash ?? null) !== (action.pageContentHashAtPrepare ?? null)) {
    return false;
  }

  return isEmptyMeta(page.metaDescription) && action.observedBefore == null;
}

async function blockAction(action: ActionRecord): Promise<ActionRecord> {
  const updated = await updateAction({
    id: action.id,
    websiteId: action.websiteId,
    expectedStatuses: [action.status],
    patch: {
      status: "blocked",
      approvedByOwnerId: null,
      approvedAt: null,
    },
  });

  return updated ?? { ...action, status: "blocked" };
}

async function previewFor(action: ActionRecord): Promise<ActionPreviewView> {
  const run = await findDecisionRunById(action.websiteId, action.decisionRunId);
  if (!run) {
    throw new ActionError("decision_stale", "This Decision is no longer current.");
  }

  return previewForWithGoal(action, run.goalSnapshot, run.gscTruncated);
}

async function previewForWithGoal(
  action: ActionRecord,
  goal: GoalSnapshot,
  truncated: boolean,
): Promise<ActionPreviewView> {
  const decision = await findDecisionById(action.websiteId, action.decisionId);
  if (!decision) {
    throw new ActionError("decision_not_found", "Decision not found.", 404);
  }

  const view = toDecisionView(decision, goal, truncated);
  return toActionPreview({
    action,
    decision: {
      id: decision.id,
      title: decision.title,
      explanation: decision.explanation,
      why: view.why,
    },
  });
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
  if (existing) {
    return previewForWithGoal(existing, context.goal, context.run.gscTruncated);
  }

  const decision = await loadSupportedDecision({
    websiteId: input.websiteId,
    decisionId: input.decisionId,
    runId: context.run.id,
  });
  const page = await requireMatchingPage({
    pageId: decision.pageId as string,
    crawlRunId: context.run.crawlRunId,
  });
  await requireSupportingObservation(decision, page.id);

  try {
    const action = await insertAction({
      websiteId: input.websiteId,
      decisionId: decision.id,
      decisionRunId: context.run.id,
      ownerId: context.ownerId,
      targetPageId: page.id,
      targetPageUrl: decision.pageUrl as string,
      observedBefore: null,
      proposedValue: null,
      mutationSpec: buildMutationSpec({
        targetUrl: decision.pageUrl as string,
        proposedValue: null,
      }),
      pageContentHashAtPrepare: page.contentHash,
      crawlRunId: context.run.crawlRunId,
      gscSyncId: context.run.gscSearchSyncId,
      siteModelId: context.run.siteModelId,
      goalId: context.run.goalId,
      evidenceRefs: decision.evidenceRefs,
    });
    return previewForWithGoal(action, context.goal, context.run.gscTruncated);
  } catch (error) {
    const raced = await findOpenActionForDecision({
      websiteId: input.websiteId,
      decisionId: input.decisionId,
    });
    if (raced) {
      return previewForWithGoal(raced, context.goal, context.run.gscTruncated);
    }
    throw error;
  }
}

export async function listActionsForWebsite(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<{ actions: ActionPreviewView[] }> {
  await requireObserveOwner(input);
  const actions = await listVisibleActionsForWebsite(input.websiteId);
  const previews: ActionPreviewView[] = [];
  for (const action of actions) {
    previews.push(await previewFor(action));
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

  return previewFor(action);
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

  const proposedValue = normalizeProposedMetaDescription(input.proposedValue);
  const updated = await updateAction({
    id: action.id,
    websiteId: input.websiteId,
    expectedStatuses: [...EDITABLE_ACTION_STATUSES],
    patch: {
      proposedValue,
      mutationSpec: buildMutationSpec({
        targetUrl: action.targetPageUrl,
        proposedValue,
      }),
      status: statusAfterProposedValue(proposedValue),
    },
  });

  if (!updated) {
    throw new ActionError("not_editable", "Approved changes cannot be edited.");
  }

  return previewForWithGoal(updated, loaded.goal, loaded.run?.gscTruncated ?? false);
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
      "Enter a meta description before approving this change.",
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

  await loadSupportedDecision({
    websiteId: input.websiteId,
    decisionId: action.decisionId,
    runId: currentRun.id,
  });
  await requireMatchingPage({
    pageId: action.targetPageId,
    crawlRunId: currentRun.crawlRunId,
  });

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

  return previewForWithGoal(approved, loaded.goal, currentRun.gscTruncated);
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

  return previewFor(cancelled);
}

export async function executeAction(input: {
  websiteId: string;
  sessionToken: string | null;
  actionId: string;
}): Promise<never> {
  const loaded = await loadCurrentRun(input);
  const action = await findActionById({
    websiteId: input.websiteId,
    actionId: input.actionId,
  });
  if (!action) {
    throw new ActionError("action_not_found", "Action not found.", 404);
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
