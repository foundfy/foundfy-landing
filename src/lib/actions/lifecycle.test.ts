import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObserveAuthError } from "@/lib/gsc/types";
import { ActionError } from "./types";

const loadDecisionPrerequisitesMock = vi.fn();
const findLatestCompletedDecisionRunMock = vi.fn();
const findDecisionByIdMock = vi.fn();
const findDecisionRunByIdMock = vi.fn();
const requireObserveOwnerMock = vi.fn();
const findOpenActionForDecisionMock = vi.fn();
const findActionByIdMock = vi.fn();
const findPageSnapshotMock = vi.fn();
const findObservationSnapshotMock = vi.fn();
const insertActionMock = vi.fn();
const updateActionMock = vi.fn();
const listVisibleActionsForWebsiteMock = vi.fn();
const countActionAttemptsMock = vi.fn();
const insertActionAttemptMock = vi.fn();
const findActionAttemptByIdempotencyKeyMock = vi.fn();
const findSuccessfulGithubExecuteAttemptMock = vi.fn();
const getWebsiteByIdMock = vi.fn();
const readGitHubAppConfigMock = vi.fn();
const commitHomepageDescriptionMock = vi.fn();
const fetchLiveHomepageMetaMock = vi.fn();
const observeHomepageDeploymentMock = vi.fn();

vi.mock("@/lib/decisions/generate", () => ({
  loadDecisionPrerequisites: (...args: unknown[]) => loadDecisionPrerequisitesMock(...args),
}));

vi.mock("@/lib/decisions/db", () => ({
  findLatestCompletedDecisionRun: (...args: unknown[]) => findLatestCompletedDecisionRunMock(...args),
  findDecisionById: (...args: unknown[]) => findDecisionByIdMock(...args),
  findDecisionRunById: (...args: unknown[]) => findDecisionRunByIdMock(...args),
}));

vi.mock("@/lib/gsc/observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwnerMock(...args),
}));

vi.mock("./db", () => ({
  findOpenActionForDecision: (...args: unknown[]) => findOpenActionForDecisionMock(...args),
  findActionById: (...args: unknown[]) => findActionByIdMock(...args),
  findPageSnapshot: (...args: unknown[]) => findPageSnapshotMock(...args),
  findObservationSnapshot: (...args: unknown[]) => findObservationSnapshotMock(...args),
  insertAction: (...args: unknown[]) => insertActionMock(...args),
  updateAction: (...args: unknown[]) => updateActionMock(...args),
  listVisibleActionsForWebsite: (...args: unknown[]) => listVisibleActionsForWebsiteMock(...args),
  countActionAttempts: (...args: unknown[]) => countActionAttemptsMock(...args),
  insertActionAttempt: (...args: unknown[]) => insertActionAttemptMock(...args),
  findActionAttemptByIdempotencyKey: (...args: unknown[]) => findActionAttemptByIdempotencyKeyMock(...args),
  findSuccessfulGithubExecuteAttempt: (...args: unknown[]) => findSuccessfulGithubExecuteAttemptMock(...args),
}));

vi.mock("@/lib/websites/repository", () => ({
  getWebsiteById: (...args: unknown[]) => getWebsiteByIdMock(...args),
}));

vi.mock("./github/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./github/config")>();
  return {
    ...actual,
    readGitHubAppConfig: (...args: unknown[]) => readGitHubAppConfigMock(...args),
  };
});

vi.mock("./github/commit", () => ({
  commitHomepageDescription: (...args: unknown[]) => commitHomepageDescriptionMock(...args),
}));

vi.mock("./live-meta", () => ({
  fetchLiveHomepageMeta: (...args: unknown[]) => fetchLiveHomepageMetaMock(...args),
  observeHomepageDeployment: (...args: unknown[]) => observeHomepageDeploymentMock(...args),
}));

vi.mock("./verify", () => ({
  verificationViewFor: async () => null,
  verifyAction: vi.fn(),
}));

vi.mock("./learn", () => ({
  learningViewFor: async () => null,
}));

import {
  approveAction,
  cancelAction,
  executeAction,
  getActionPreview,
  listActionsForWebsite,
  prepareAction,
  updateActionProposal,
} from "./lifecycle";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const SESSION = "owner-session-token";
const fetchSpy = vi.spyOn(globalThis, "fetch");

function goal() {
  return {
    id: "goal-1",
    primaryType: "grow_signups" as const,
    secondaryType: null,
    note: null,
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function run() {
  return {
    id: "run-1",
    websiteId: WEBSITE_ID,
    siteModelId: "site-model-1",
    crawlRunId: "crawl-1",
    gscSearchSyncId: "sync-1",
    engineVersion: "decision_v1",
    status: "completed" as const,
    goalId: "goal-1",
    goalSnapshot: goal(),
    gscTruncated: false,
    errorCode: null,
    createdAt: "2026-09-24T00:00:00.000Z",
    completedAt: "2026-09-24T00:00:01.000Z",
  };
}

function missingMetaRefs() {
  return [
    { kind: "crawl_run" as const, recordId: "crawl-1", snapshot: {} },
    {
      kind: "gsc_sync" as const,
      recordId: "sync-1",
      snapshot: { periodStart: "2026-08-27", periodEnd: "2026-09-23" },
    },
    { kind: "site_model" as const, recordId: "site-model-1", snapshot: {} },
    { kind: "goal" as const, recordId: "goal-1", snapshot: { primaryType: "grow_signups" } },
    {
      kind: "observation" as const,
      recordId: "obs-1",
      snapshot: { ruleKey: "page_fundamentals.missing_meta_description", title: "Missing meta description" },
    },
    { kind: "gsc_evidence" as const, recordId: "gsc-1", snapshot: { impressions: 40, clicks: 4 } },
    { kind: "page" as const, recordId: "page-1", snapshot: { pageUrl: "https://www.dbhobby.com/es/gutta" } },
  ];
}

function missingMetaDecision() {
  return {
    id: "decision-1",
    decisionRunId: "run-1",
    websiteId: WEBSITE_ID,
    decisionType: "existing_demand_page_issue" as const,
    title: "Add a meta description on /es/gutta",
    explanation:
      "This page already appears in Google Search, and Foundfy found a missing meta description on the same page.",
    pageUrl: "https://www.dbhobby.com/es/gutta",
    pageId: "page-1",
    priorityBand: "do_first" as const,
    rank: 1,
    scoring: { issueImportance: 50, searchDemand: 80, evidenceConfidence: 90, total: 68 },
    confidence: "exact_match" as const,
    createdAt: "2026-09-24T00:00:00.000Z",
    evidenceRefs: missingMetaRefs(),
  };
}

function titleDecision() {
  return {
    ...missingMetaDecision(),
    id: "decision-title",
    title: "Improve the page title on /es/gutta",
    evidenceRefs: missingMetaRefs().map((ref) =>
      ref.kind === "observation"
        ? { ...ref, snapshot: { ruleKey: "page_fundamentals.missing_title", title: "Missing page title" } }
        : ref,
    ),
  };
}

function typeBDecision() {
  return {
    ...missingMetaDecision(),
    id: "decision-b",
    decisionType: "inspect_unanalyzed_page" as const,
    pageId: null,
    evidenceRefs: missingMetaRefs().filter((ref) => ref.kind !== "observation"),
  };
}

const SHARED_TITLE = "Pintura sobre seda | DBHOBBY";
const HOME_URL = "https://www.dbhobby.com/";
const CA_URL = "https://www.dbhobby.com/ca/pintura-en-seda";

function typeCDuplicateTitleRefs() {
  return [
    { kind: "crawl_run" as const, recordId: "crawl-1", snapshot: {} },
    {
      kind: "gsc_sync" as const,
      recordId: "sync-1",
      snapshot: { periodStart: "2026-08-27", periodEnd: "2026-09-23" },
    },
    { kind: "site_model" as const, recordId: "site-model-1", snapshot: {} },
    { kind: "goal" as const, recordId: "goal-1", snapshot: { primaryType: "grow_signups" } },
    {
      kind: "observation" as const,
      recordId: "obs-ca",
      snapshot: { ruleKey: "page_fundamentals.duplicate_title", title: "Duplicate page title" },
    },
    {
      kind: "gsc_evidence" as const,
      recordId: "gsc-ca",
      snapshot: { pageUrl: CA_URL, impressions: 10, clicks: 1 },
    },
    { kind: "page" as const, recordId: "page-ca", snapshot: { pageUrl: CA_URL } },
    {
      kind: "observation" as const,
      recordId: "obs-home",
      snapshot: { ruleKey: "page_fundamentals.duplicate_title", title: "Duplicate page title" },
    },
    {
      kind: "gsc_evidence" as const,
      recordId: "gsc-home",
      snapshot: { pageUrl: HOME_URL, impressions: 80, clicks: 6 },
    },
    { kind: "page" as const, recordId: "page-home", snapshot: { pageUrl: HOME_URL } },
  ];
}

function typeCDuplicateTitleDecision() {
  return {
    ...missingMetaDecision(),
    id: "decision-c",
    decisionType: "multi_page_issue_with_visibility" as const,
    title: "Make duplicate titles unique on 2 Google-visible pages including /",
    pageUrl: HOME_URL,
    pageId: "page-home",
    evidenceRefs: typeCDuplicateTitleRefs(),
  };
}

function titleObservation(id: string, pageId: string) {
  return {
    id,
    pageId,
    ruleKey: "page_fundamentals.duplicate_title",
    status: "active",
    evidence: { title: SHARED_TITLE, duplicatePages: [CA_URL, HOME_URL] },
  };
}

function preparedTitleAction() {
  return {
    ...preparedAction(),
    id: "action-title",
    decisionId: "decision-c",
    actionType: "update_page_title" as const,
    targetPageId: "page-home",
    targetPageUrl: HOME_URL,
    field: "title" as const,
    observedBefore: SHARED_TITLE,
    proposedValue: null,
    mutationSpec: {
      targetUrl: HOME_URL,
      field: "title" as const,
      before: SHARED_TITLE,
      after: null,
    },
  };
}

function preparedAction() {
  return {
    id: "action-1",
    websiteId: WEBSITE_ID,
    decisionId: "decision-1",
    decisionRunId: "run-1",
    ownerId: "owner-1",
    actionType: "update_meta_description" as const,
    targetPageId: "page-1",
    targetPageUrl: "https://www.dbhobby.com/es/gutta",
    field: "meta_description" as const,
    observedBefore: null,
    proposedValue: null,
    mutationSpec: {
      targetUrl: "https://www.dbhobby.com/es/gutta",
      field: "meta_description" as const,
      before: null,
      after: null,
    },
    pageContentHashAtPrepare: "hash-1",
    crawlRunId: "crawl-1",
    gscSyncId: "sync-1",
    siteModelId: "site-model-1",
    goalId: "goal-1",
    status: "prepared" as const,
    approvedByOwnerId: null,
    approvedAt: null,
    createdAt: "2026-09-26T00:00:00.000Z",
    updatedAt: "2026-09-26T00:00:00.000Z",
    evidenceRefs: missingMetaRefs(),
  };
}

function foundfyApprovedAction() {
  return {
    ...preparedAction(),
    targetPageUrl: "https://www.foundfy.me/",
    proposedValue: "New homepage description.",
    mutationSpec: {
      targetUrl: "https://www.foundfy.me/",
      field: "meta_description" as const,
      before: null,
      after: "New homepage description.",
    },
    status: "approved" as const,
    approvedByOwnerId: "owner-1",
    approvedAt: "2026-09-26T01:00:00.000Z",
  };
}

function githubConfig() {
  return {
    appId: "1",
    installationId: "99",
    privateKey: "-----BEGIN RSA PRIVATE KEY-----\nA\n-----END RSA PRIVATE KEY-----",
  };
}

function githubArtifact(overrides: Record<string, unknown> = {}) {
  return {
    provider: "github",
    repo: "foundfy/foundfy-landing",
    branch: "main",
    filePath: "src/lib/seo/homepage-description.ts",
    headShaBefore: "head-before",
    commitShaAfter: "commit-after",
    blobShaBefore: "blob-before",
    blobShaAfter: "blob-after",
    treeShaAfter: "tree-after",
    beforeValue: null,
    afterValue: "New homepage description.",
    installationId: "99",
    recovered: false,
    ...overrides,
  };
}

function readyContext() {
  return {
    context: { owner: { id: "owner-1" } },
    siteModel: { id: "site-model-1" },
    crawl: { id: "crawl-1" },
    sync: { id: "sync-1" },
    goal: goal(),
  };
}

describe("ACT v0 lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy.mockClear();
    requireObserveOwnerMock.mockResolvedValue({ owner: { id: "owner-1" } });
    loadDecisionPrerequisitesMock.mockResolvedValue(readyContext());
    findLatestCompletedDecisionRunMock.mockResolvedValue(run());
    findDecisionRunByIdMock.mockResolvedValue(run());
    findDecisionByIdMock.mockResolvedValue(missingMetaDecision());
    findOpenActionForDecisionMock.mockResolvedValue(null);
    findPageSnapshotMock.mockResolvedValue({
      id: "page-1",
      crawlRunId: "crawl-1",
      requestedUrl: "https://www.dbhobby.com/es/gutta",
      finalUrl: "https://www.dbhobby.com/es/gutta",
      title: null,
      metaDescription: null,
      contentHash: "hash-1",
    });
    findObservationSnapshotMock.mockResolvedValue({
      id: "obs-1",
      pageId: "page-1",
      ruleKey: "page_fundamentals.missing_meta_description",
      status: "active",
      evidence: { metaDescription: null },
    });
    insertActionMock.mockImplementation(
      async (input: {
        evidenceRefs: unknown[];
        actionType?: "update_meta_description" | "update_page_title";
        field?: "meta_description" | "title";
        targetPageId?: string;
        targetPageUrl?: string;
        observedBefore?: string | null;
        proposedValue?: string | null;
        mutationSpec?: Record<string, unknown>;
      }) => ({
        ...preparedAction(),
        actionType: input.actionType ?? "update_meta_description",
        field: input.field ?? "meta_description",
        targetPageId: input.targetPageId ?? "page-1",
        targetPageUrl: input.targetPageUrl ?? preparedAction().targetPageUrl,
        observedBefore: input.observedBefore ?? null,
        proposedValue: input.proposedValue ?? null,
        mutationSpec: input.mutationSpec ?? preparedAction().mutationSpec,
        evidenceRefs: input.evidenceRefs,
      }),
    );
    updateActionMock.mockImplementation(
      async (input: { id: string; websiteId: string; patch: Record<string, unknown> }) => {
        const current =
          (await findActionByIdMock({ websiteId: input.websiteId, actionId: input.id })) ?? preparedAction();
        return {
          ...current,
          ...input.patch,
          mutationSpec: input.patch.mutationSpec ?? current.mutationSpec,
          status: input.patch.status ?? current.status,
          proposedValue:
            input.patch.proposedValue !== undefined ? input.patch.proposedValue : current.proposedValue,
        };
      },
    );
    countActionAttemptsMock.mockResolvedValue(0);
    insertActionAttemptMock.mockResolvedValue({ id: "attempt-1" });
    findActionAttemptByIdempotencyKeyMock.mockResolvedValue(null);
    findSuccessfulGithubExecuteAttemptMock.mockResolvedValue(null);
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "www.dbhobby.com" });
    listVisibleActionsForWebsiteMock.mockResolvedValue([]);
    readGitHubAppConfigMock.mockReturnValue(null);
    commitHomepageDescriptionMock.mockResolvedValue(githubArtifact());
    fetchLiveHomepageMetaMock.mockResolvedValue(null);
    observeHomepageDeploymentMock.mockResolvedValue({ observed: false, observedAt: null });
  });

  it("prepares a current Type A missing-meta Decision with copied provenance", async () => {
    const preview = await prepareAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      decisionId: "decision-1",
    });

    expect(preview.status).toBe("prepared");
    expect(preview.proposedValue).toBeNull();
    expect(preview.currentValue).toBeNull();
    expect(preview.mutationSpec).toEqual({
      targetUrl: "https://www.dbhobby.com/es/gutta",
      field: "meta_description",
      before: null,
      after: null,
    });
    expect(preview.verificationPlan).toContain("re-check this page");
    expect(preview.verificationPlan).not.toMatch(/rank|traffic/i);
    expect(preview.evidenceRefs).toEqual(missingMetaRefs());
    expect(preview.provenance).toEqual({
      decisionRunId: "run-1",
      crawlRunId: "crawl-1",
      gscSyncId: "sync-1",
      siteModelId: "site-model-1",
      goalId: "goal-1",
    });
    expect(insertActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        observedBefore: null,
        proposedValue: null,
        evidenceRefs: missingMetaRefs(),
      }),
    );
  });

  it("rejects title-length, canonical, H1, and Type B", async () => {
    findDecisionByIdMock.mockResolvedValueOnce({
      ...titleDecision(),
      evidenceRefs: missingMetaRefs().map((ref) =>
        ref.kind === "observation"
          ? { ...ref, snapshot: { ruleKey: "page_fundamentals.title_length_out_of_range" } }
          : ref,
      ),
    });
    await expect(
      prepareAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, decisionId: "decision-title" }),
    ).rejects.toMatchObject({ code: "unsupported_decision" });

    findDecisionByIdMock.mockResolvedValueOnce({
      ...missingMetaDecision(),
      evidenceRefs: missingMetaRefs().map((ref) =>
        ref.kind === "observation"
          ? { ...ref, snapshot: { ruleKey: "indexability.canonical_points_elsewhere" } }
          : ref,
      ),
    });
    await expect(
      prepareAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, decisionId: "decision-canonical" }),
    ).rejects.toMatchObject({ code: "unsupported_decision" });

    findDecisionByIdMock.mockResolvedValueOnce({
      ...missingMetaDecision(),
      evidenceRefs: missingMetaRefs().map((ref) =>
        ref.kind === "observation"
          ? { ...ref, snapshot: { ruleKey: "page_fundamentals.missing_h1" } }
          : ref,
      ),
    });
    await expect(
      prepareAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, decisionId: "decision-h1" }),
    ).rejects.toMatchObject({ code: "unsupported_decision" });

    findDecisionByIdMock.mockResolvedValueOnce(typeBDecision());
    await expect(
      prepareAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, decisionId: "decision-b" }),
    ).rejects.toMatchObject({ code: "unsupported_decision" });

    expect(insertActionMock).not.toHaveBeenCalled();
  });

  it("blocks prepare when the Decision run is computed stale", async () => {
    loadDecisionPrerequisitesMock.mockResolvedValue({
      ...readyContext(),
      crawl: { id: "crawl-2" },
    });

    await expect(
      prepareAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, decisionId: "decision-1" }),
    ).rejects.toMatchObject({ code: "decision_stale" });
    expect(insertActionMock).not.toHaveBeenCalled();
  });

  it("returns the existing open action instead of inserting a duplicate", async () => {
    findOpenActionForDecisionMock.mockResolvedValue(preparedAction());

    const first = await prepareAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      decisionId: "decision-1",
    });
    const second = await prepareAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      decisionId: "decision-1",
    });

    expect(first.id).toBe("action-1");
    expect(second.id).toBe("action-1");
    expect(insertActionMock).not.toHaveBeenCalled();
  });

  it("lets the owner edit the proposed value before approval", async () => {
    findActionByIdMock.mockResolvedValue(preparedAction());

    const preview = await updateActionProposal({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-1",
      proposedValue: "  Pintura sobre seda en Barcelona.  ",
    });

    expect(preview.status).toBe("awaiting_approval");
    expect(preview.proposedValue).toBe("Pintura sobre seda en Barcelona.");
    expect(preview.mutationSpec.after).toBe("Pintura sobre seda en Barcelona.");
    expect(updateActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedStatuses: ["prepared", "awaiting_approval"],
        patch: expect.objectContaining({
          proposedValue: "Pintura sobre seda en Barcelona.",
          status: "awaiting_approval",
        }),
      }),
    );
  });

  it("requires a proposed value before approval", async () => {
    findActionByIdMock.mockResolvedValue(preparedAction());

    await expect(
      approveAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "empty_proposed_value" });
    expect(updateActionMock).not.toHaveBeenCalled();
  });

  it("approves an editable action with a proposed value", async () => {
    findActionByIdMock.mockResolvedValue({
      ...preparedAction(),
      proposedValue: "Pintura sobre seda.",
      status: "awaiting_approval",
      mutationSpec: {
        targetUrl: "https://www.dbhobby.com/es/gutta",
        field: "meta_description",
        before: null,
        after: "Pintura sobre seda.",
      },
    });

    const preview = await approveAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-1",
    });

    expect(preview.status).toBe("approved");
    expect(preview.executeAvailable).toBe(false);
    expect(preview.executeBlockedReason).toBe("adapter_not_connected");
    expect(updateActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({
          status: "approved",
          approvedByOwnerId: "owner-1",
        }),
      }),
    );
  });

  it("blocks approval when evidence becomes stale after prepare", async () => {
    findActionByIdMock.mockResolvedValue({
      ...preparedAction(),
      proposedValue: "Pintura sobre seda.",
      status: "awaiting_approval",
    });
    loadDecisionPrerequisitesMock.mockResolvedValue({
      ...readyContext(),
      crawl: { id: "crawl-2" },
    });

    await expect(
      approveAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "decision_stale" });
    expect(updateActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ patch: expect.objectContaining({ status: "blocked" }) }),
    );
  });

  it("does not allow editing after approval", async () => {
    findActionByIdMock.mockResolvedValue({
      ...preparedAction(),
      status: "approved",
      proposedValue: "Pintura sobre seda.",
    });

    await expect(
      updateActionProposal({
        websiteId: WEBSITE_ID,
        sessionToken: SESSION,
        actionId: "action-1",
        proposedValue: "Changed copy",
      }),
    ).rejects.toMatchObject({ code: "not_editable" });
  });

  it("cancels a prepared action and preserves the row as cancelled", async () => {
    findActionByIdMock.mockResolvedValue(preparedAction());
    updateActionMock.mockResolvedValue({ ...preparedAction(), status: "cancelled" });

    const preview = await cancelAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-1",
    });

    expect(preview.status).toBe("cancelled");
    expect(updateActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedStatuses: ["prepared", "awaiting_approval", "approved"],
        patch: { status: "cancelled" },
      }),
    );
  });

  it("records an execute attempt and fail-closes without any external call", async () => {
    findActionByIdMock.mockResolvedValue({
      ...preparedAction(),
      status: "approved",
      proposedValue: "Pintura sobre seda.",
    });
    countActionAttemptsMock.mockResolvedValue(0);
    insertActionAttemptMock.mockResolvedValue({ id: "attempt-1" });

    await expect(
      executeAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "adapter_not_connected" });

    expect(insertActionAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "failure",
        errorCode: "adapter_not_connected",
        provider: null,
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(updateActionMock).not.toHaveBeenCalled();
  });

  it("denies a missing owner session", async () => {
    loadDecisionPrerequisitesMock.mockRejectedValue(new ObserveAuthError(401, "Owner session required."));

    await expect(
      prepareAction({ websiteId: WEBSITE_ID, sessionToken: null, decisionId: "decision-1" }),
    ).rejects.toBeInstanceOf(ObserveAuthError);
  });

  it("blocks a stale approved action before any provider or GitHub call", async () => {
    findActionByIdMock.mockResolvedValue({
      ...foundfyApprovedAction(),
      crawlRunId: "crawl-old",
    });
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "foundfy.me" });
    readGitHubAppConfigMock.mockReturnValue(githubConfig());

    await expect(
      executeAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "decision_stale" });

    expect(updateActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: { status: "blocked" },
      }),
    );
    expect(updateActionMock.mock.calls[0]?.[0].patch).not.toHaveProperty("approvedByOwnerId");
    expect(updateActionMock.mock.calls[0]?.[0].patch).not.toHaveProperty("approvedAt");
    expect(insertActionAttemptMock).not.toHaveBeenCalled();
    expect(fetchLiveHomepageMetaMock).not.toHaveBeenCalled();
    expect(commitHomepageDescriptionMock).not.toHaveBeenCalled();
  });

  it("preserves original approval identity and time when blocking", async () => {
    findActionByIdMock.mockResolvedValue(foundfyApprovedAction());
    loadDecisionPrerequisitesMock.mockResolvedValue({
      ...readyContext(),
      crawl: { id: "crawl-2" },
    });

    await expect(
      executeAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "decision_stale" });

    expect(updateActionMock).toHaveBeenCalledTimes(1);
    expect(updateActionMock.mock.calls[0]?.[0].patch).toEqual({ status: "blocked" });
  });

  it("exposes unsafe_stale on Preview GET without mutating the action", async () => {
    findActionByIdMock.mockResolvedValue({
      ...foundfyApprovedAction(),
      crawlRunId: "crawl-old",
    });
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "foundfy.me" });
    readGitHubAppConfigMock.mockReturnValue(githubConfig());

    const preview = await getActionPreview({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-1",
    });

    expect(preview.executeAvailable).toBe(false);
    expect(preview.executeBlockedReason).toBe("unsafe_stale");
    expect(updateActionMock).not.toHaveBeenCalled();
    expect(insertActionAttemptMock).not.toHaveBeenCalled();
    expect(fetchLiveHomepageMetaMock).not.toHaveBeenCalled();
  });

  it("lets a safe Foundfy homepage action reach the Git adapter", async () => {
    findActionByIdMock.mockResolvedValue(foundfyApprovedAction());
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "foundfy.me" });
    readGitHubAppConfigMock.mockReturnValue(githubConfig());
    countActionAttemptsMock.mockResolvedValue(0);

    const preview = await executeAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-1",
    });

    expect(commitHomepageDescriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: "action-1",
        expectedBefore: null,
        afterValue: "New homepage description.",
        recoverOnly: false,
      }),
    );
    expect(preview.status).toBe("executed");
    expect(insertActionAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "action-1:github:execute",
        provider: "github",
        result: "success",
        artifact: expect.objectContaining({
          commitShaAfter: "commit-after",
          deploymentObserved: false,
        }),
      }),
    );
  });

  it("keeps every non-Foundfy target unsupported", async () => {
    findActionByIdMock.mockResolvedValue({
      ...foundfyApprovedAction(),
      targetPageUrl: "https://www.dbhobby.com/es/gutta",
    });
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "www.dbhobby.com" });
    readGitHubAppConfigMock.mockReturnValue(githubConfig());

    await expect(
      executeAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "adapter_not_connected" });

    expect(fetchLiveHomepageMetaMock).not.toHaveBeenCalled();
    expect(commitHomepageDescriptionMock).not.toHaveBeenCalled();
  });

  it("prevents a Git call when live metadata no longer matches before", async () => {
    findActionByIdMock.mockResolvedValue(foundfyApprovedAction());
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "foundfy.me" });
    readGitHubAppConfigMock.mockReturnValue(githubConfig());
    fetchLiveHomepageMetaMock.mockResolvedValue("Some other live description.");

    await expect(
      executeAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "before_state_changed" });

    expect(commitHomepageDescriptionMock).not.toHaveBeenCalled();
    expect(updateActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ patch: { status: "blocked" } }),
    );
  });

  it("does not treat a changed content_hash as a metadata before mismatch", async () => {
    findActionByIdMock.mockResolvedValue(foundfyApprovedAction());
    findPageSnapshotMock.mockResolvedValue({
      id: "page-1",
      crawlRunId: "crawl-1",
      requestedUrl: "https://www.foundfy.me/",
      finalUrl: "https://www.foundfy.me/",
      title: null,
      metaDescription: null,
      contentHash: "hash-changed",
    });
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "foundfy.me" });
    readGitHubAppConfigMock.mockReturnValue(githubConfig());
    countActionAttemptsMock.mockResolvedValue(0);

    await executeAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-1",
    });

    expect(commitHomepageDescriptionMock).toHaveBeenCalled();
    expect(fetchLiveHomepageMetaMock).toHaveBeenCalled();
  });

  it("blocks when Git source before-state no longer matches", async () => {
    findActionByIdMock.mockResolvedValue(foundfyApprovedAction());
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "foundfy.me" });
    readGitHubAppConfigMock.mockReturnValue(githubConfig());
    commitHomepageDescriptionMock.mockRejectedValue(
      new ActionError("before_state_changed", "Git before mismatch."),
    );

    await expect(
      executeAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "before_state_changed" });

    expect(updateActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ patch: { status: "blocked" } }),
    );
  });

  it("keeps the action approved after a concurrent HEAD change", async () => {
    findActionByIdMock.mockResolvedValue(foundfyApprovedAction());
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "foundfy.me" });
    readGitHubAppConfigMock.mockReturnValue(githubConfig());
    commitHomepageDescriptionMock.mockRejectedValue(
      new ActionError("git_concurrency_conflict", "main moved."),
    );

    await expect(
      executeAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "git_concurrency_conflict" });

    expect(insertActionAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({ result: "failure", errorCode: "git_concurrency_conflict" }),
    );
    expect(updateActionMock).not.toHaveBeenCalled();
  });

  it("returns the previous successful execute result instead of creating another commit", async () => {
    findActionByIdMock.mockResolvedValue(foundfyApprovedAction());
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "foundfy.me" });
    readGitHubAppConfigMock.mockReturnValue(githubConfig());
    findActionAttemptByIdempotencyKeyMock.mockResolvedValue({
      id: "attempt-success",
      result: "success",
      artifact: githubArtifact(),
    });

    const preview = await executeAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-1",
    });

    expect(preview.status).toBe("executed");
    expect(commitHomepageDescriptionMock).not.toHaveBeenCalled();
    expect(fetchLiveHomepageMetaMock).not.toHaveBeenCalled();
  });

  it("does not claim a manual after-state as a Foundfy execution", async () => {
    findActionByIdMock.mockResolvedValue(foundfyApprovedAction());
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "foundfy.me" });
    readGitHubAppConfigMock.mockReturnValue(githubConfig());
    fetchLiveHomepageMetaMock.mockResolvedValue("New homepage description.");
    commitHomepageDescriptionMock.mockRejectedValue(
      new ActionError("remote_state_changed", "Already equal after."),
    );

    await expect(
      executeAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "remote_state_changed" });

    expect(commitHomepageDescriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ recoverOnly: true }),
    );
    expect(updateActionMock).not.toHaveBeenCalled();
  });

  it("recovers a Foundfy-owned commit after an interrupted response", async () => {
    findActionByIdMock.mockResolvedValue(foundfyApprovedAction());
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "foundfy.me" });
    readGitHubAppConfigMock.mockReturnValue(githubConfig());
    countActionAttemptsMock.mockResolvedValue(0);
    commitHomepageDescriptionMock.mockResolvedValue(githubArtifact({ recovered: true }));

    const preview = await executeAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-1",
    });

    expect(preview.status).toBe("executed");
    expect(commitHomepageDescriptionMock).toHaveBeenCalledTimes(1);
    expect(insertActionAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "success",
        artifact: expect.objectContaining({ recovered: true, commitShaAfter: "commit-after" }),
      }),
    );
  });

  it("leaves the action approved after a provider failure", async () => {
    findActionByIdMock.mockResolvedValue(foundfyApprovedAction());
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "foundfy.me" });
    readGitHubAppConfigMock.mockReturnValue(githubConfig());
    commitHomepageDescriptionMock.mockRejectedValue(
      new ActionError("github_auth_failed", "token failed"),
    );

    await expect(
      executeAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-1" }),
    ).rejects.toMatchObject({ code: "github_auth_failed" });

    expect(updateActionMock).not.toHaveBeenCalled();
    expect(insertActionAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({ result: "failure", errorCode: "github_auth_failed" }),
    );
  });

  it("does not undo executed state when deployment is not yet observed", async () => {
    findActionByIdMock.mockResolvedValue(foundfyApprovedAction());
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "foundfy.me" });
    readGitHubAppConfigMock.mockReturnValue(githubConfig());
    countActionAttemptsMock.mockResolvedValue(0);
    observeHomepageDeploymentMock.mockResolvedValue({ observed: false, observedAt: null });

    const preview = await executeAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-1",
    });

    expect(preview.status).toBe("executed");
    expect(insertActionAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "success",
        artifact: expect.objectContaining({ deploymentObserved: false }),
      }),
    );
  });

  it("keeps an approved action visible after its source Decision leaves the current run", async () => {
    findLatestCompletedDecisionRunMock.mockResolvedValue({ ...run(), id: "run-2" });
    listVisibleActionsForWebsiteMock.mockResolvedValue([foundfyApprovedAction()]);

    const { actions } = await listActionsForWebsite({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.id).toBe("action-1");
    expect(actions[0]?.status).toBe("approved");
    expect(actions[0]?.approvedAt).toBe("2026-09-26T01:00:00.000Z");
    expect(actions[0]?.executeAvailable).toBe(false);
    expect(actions[0]?.executeBlockedReason).toBe("unsafe_stale");
    expect(updateActionMock).not.toHaveBeenCalled();
    expect(insertActionAttemptMock).not.toHaveBeenCalled();
    expect(fetchLiveHomepageMetaMock).not.toHaveBeenCalled();
    expect(commitHomepageDescriptionMock).not.toHaveBeenCalled();
  });

  it("still lists a persisted action when the original Decision row is gone", async () => {
    findLatestCompletedDecisionRunMock.mockResolvedValue({ ...run(), id: "run-2" });
    listVisibleActionsForWebsiteMock.mockResolvedValue([foundfyApprovedAction()]);
    findDecisionByIdMock.mockResolvedValue(null);

    const { actions } = await listActionsForWebsite({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.targetPage.url).toBe("https://www.foundfy.me/");
    expect(actions[0]?.status).toBe("approved");
    expect(actions[0]?.executeBlockedReason).toBe("unsafe_stale");
    expect(updateActionMock).not.toHaveBeenCalled();
  });

  it("still lists executed history after Google evidence IDs are cleared", async () => {
    findLatestCompletedDecisionRunMock.mockResolvedValue({ ...run(), id: "run-2" });
    listVisibleActionsForWebsiteMock.mockResolvedValue([
      {
        ...foundfyApprovedAction(),
        status: "executed" as const,
        decisionId: null,
        decisionRunId: null,
        gscSyncId: null,
      },
    ]);

    const { actions } = await listActionsForWebsite({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.status).toBe("executed");
    expect(actions[0]?.provenance.gscSyncId).toBeNull();
    expect(findDecisionRunByIdMock).not.toHaveBeenCalled();
  });

  describe("ACT v1 title prepare", () => {
  it("prepares a Type A missing-title Decision with before = null", async () => {
    findDecisionByIdMock.mockResolvedValue(titleDecision());
    findObservationSnapshotMock.mockResolvedValue({
      id: "obs-1",
      pageId: "page-1",
      ruleKey: "page_fundamentals.missing_title",
      status: "active",
      evidence: { title: null },
    });

    const preview = await prepareAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      decisionId: "decision-title",
    });

    expect(preview.actionType).toBe("update_page_title");
    expect(preview.proposedValue).toBeNull();
    expect(preview.currentValue).toBeNull();
    expect(preview.mutationSpec).toEqual({
      targetUrl: "https://www.dbhobby.com/es/gutta",
      field: "title",
      before: null,
      after: null,
    });
    expect(insertActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "update_page_title",
        field: "title",
        observedBefore: null,
        proposedValue: null,
      }),
    );
  });

  it("prepares Type A duplicate-title with the exact current title", async () => {
    findDecisionByIdMock.mockResolvedValue({
      ...titleDecision(),
      evidenceRefs: missingMetaRefs().map((ref) =>
        ref.kind === "observation"
          ? { ...ref, snapshot: { ruleKey: "page_fundamentals.duplicate_title" } }
          : ref,
      ),
    });
    findPageSnapshotMock.mockResolvedValue({
      id: "page-1",
      crawlRunId: "crawl-1",
      requestedUrl: "https://www.dbhobby.com/es/gutta",
      finalUrl: "https://www.dbhobby.com/es/gutta",
      title: SHARED_TITLE,
      metaDescription: null,
      contentHash: "hash-1",
    });
    findObservationSnapshotMock.mockResolvedValue({
      id: "obs-1",
      pageId: "page-1",
      ruleKey: "page_fundamentals.duplicate_title",
      status: "active",
      evidence: { title: SHARED_TITLE, duplicatePages: ["https://www.dbhobby.com/es/gutta", CA_URL] },
    });

    const preview = await prepareAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      decisionId: "decision-title",
    });

    expect(preview.mutationSpec).toEqual({
      targetUrl: "https://www.dbhobby.com/es/gutta",
      field: "title",
      before: SHARED_TITLE,
      after: null,
    });
    expect(preview.currentValue).toBe(SHARED_TITLE);
  });

  it("prepares Type C duplicate-title for the DECIDE primary page only", async () => {
    findDecisionByIdMock.mockResolvedValue(typeCDuplicateTitleDecision());
    findPageSnapshotMock.mockResolvedValue({
      id: "page-home",
      crawlRunId: "crawl-1",
      requestedUrl: HOME_URL,
      finalUrl: HOME_URL,
      title: SHARED_TITLE,
      metaDescription: null,
      contentHash: "hash-1",
    });
    findObservationSnapshotMock.mockImplementation(async (id: string) =>
      id === "obs-ca" ? titleObservation("obs-ca", "page-ca") : titleObservation("obs-home", "page-home"),
    );

    const preview = await prepareAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      decisionId: "decision-c",
    });

    expect(preview.actionType).toBe("update_page_title");
    expect(preview.targetPage).toEqual({ id: "page-home", url: HOME_URL });
    expect(preview.mutationSpec).toEqual({
      targetUrl: HOME_URL,
      field: "title",
      before: SHARED_TITLE,
      after: null,
    });
    expect(preview.mutationSpec).not.toHaveProperty("targetUrls");
    expect(JSON.stringify(preview.mutationSpec)).not.toContain(CA_URL);
    const pageHome = preview.evidenceRefs.find((ref) => ref.kind === "page" && ref.recordId === "page-home");
    expect(pageHome?.snapshot).toMatchObject({
      pageUrl: HOME_URL,
      sharedTitle: SHARED_TITLE,
      otherMemberUrls: [CA_URL],
      primaryReason: "decision_primary_highest_demand",
    });
    expect(preview.verificationPlan).not.toMatch(/fix all duplicate titles/i);
    expect(insertActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "update_page_title",
        targetPageId: "page-home",
        targetPageUrl: HOME_URL,
        field: "title",
        observedBefore: SHARED_TITLE,
        proposedValue: null,
      }),
    );
  });

  it("lets the owner edit and approve a title, then fail-closes Execute without Git", async () => {
    findActionByIdMock.mockResolvedValue(preparedTitleAction());
    findPageSnapshotMock.mockResolvedValue({
      id: "page-home",
      crawlRunId: "crawl-1",
      requestedUrl: HOME_URL,
      finalUrl: HOME_URL,
      title: SHARED_TITLE,
      metaDescription: null,
      contentHash: "hash-1",
    });

    const edited = await updateActionProposal({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-title",
      proposedValue: "  Pintura sobre seda en Barcelona | DBHobby  ",
    });
    expect(edited.proposedValue).toBe("Pintura sobre seda en Barcelona | DBHobby");
    expect(edited.mutationSpec.after).toBe("Pintura sobre seda en Barcelona | DBHobby");
    expect(edited.mutationSpec.before).toBe(SHARED_TITLE);

    findActionByIdMock.mockResolvedValue({
      ...preparedTitleAction(),
      proposedValue: null,
      status: "prepared" as const,
    });
    await expect(
      approveAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-title" }),
    ).rejects.toMatchObject({ code: "empty_proposed_value" });

    findDecisionByIdMock.mockResolvedValue(typeCDuplicateTitleDecision());
    findObservationSnapshotMock.mockImplementation(async (id: string) =>
      id === "obs-ca" ? titleObservation("obs-ca", "page-ca") : titleObservation("obs-home", "page-home"),
    );
    findActionByIdMock.mockResolvedValue({
      ...preparedTitleAction(),
      proposedValue: "Pintura sobre seda en Barcelona | DBHobby",
      status: "awaiting_approval" as const,
      mutationSpec: {
        targetUrl: HOME_URL,
        field: "title" as const,
        before: SHARED_TITLE,
        after: "Pintura sobre seda en Barcelona | DBHobby",
      },
    });
    const approved = await approveAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-title",
    });
    expect(approved.status).toBe("approved");

    findActionByIdMock.mockResolvedValue({
      ...preparedTitleAction(),
      status: "approved" as const,
      proposedValue: "Pintura sobre seda en Barcelona | DBHobby",
    });
    getWebsiteByIdMock.mockResolvedValue({ id: WEBSITE_ID, hostname: "foundfy.me" });
    readGitHubAppConfigMock.mockReturnValue(githubConfig());
    await expect(
      executeAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-title" }),
    ).rejects.toMatchObject({ code: "adapter_not_connected" });
    expect(commitHomepageDescriptionMock).not.toHaveBeenCalled();
    expect(fetchLiveHomepageMetaMock).not.toHaveBeenCalled();
    expect(insertActionAttemptMock).toHaveBeenCalledWith(
      expect.objectContaining({ result: "failure", errorCode: "adapter_not_connected", provider: null }),
    );
  });

  it("fail-closes when the crawl title changes after Prepare", async () => {
    findActionByIdMock.mockResolvedValue({
      ...preparedTitleAction(),
      proposedValue: "Unique title | DBHobby",
      status: "awaiting_approval" as const,
    });
    findPageSnapshotMock.mockResolvedValue({
      id: "page-home",
      crawlRunId: "crawl-1",
      requestedUrl: HOME_URL,
      finalUrl: HOME_URL,
      title: "Changed title",
      metaDescription: null,
      contentHash: "hash-1",
    });

    await expect(
      approveAction({ websiteId: WEBSITE_ID, sessionToken: SESSION, actionId: "action-title" }),
    ).rejects.toMatchObject({ code: "decision_stale" });
    expect(updateActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ patch: expect.objectContaining({ status: "blocked" }) }),
    );
  });

  it("does not allow editing an approved title and still lists it in history", async () => {
    findPageSnapshotMock.mockResolvedValue({
      id: "page-home",
      crawlRunId: "crawl-1",
      requestedUrl: HOME_URL,
      finalUrl: HOME_URL,
      title: SHARED_TITLE,
      metaDescription: null,
      contentHash: "hash-1",
    });
    findActionByIdMock.mockResolvedValue({
      ...preparedTitleAction(),
      status: "approved" as const,
      proposedValue: "Unique title | DBHobby",
    });
    await expect(
      updateActionProposal({
        websiteId: WEBSITE_ID,
        sessionToken: SESSION,
        actionId: "action-title",
        proposedValue: "Changed",
      }),
    ).rejects.toMatchObject({ code: "not_editable" });

    listVisibleActionsForWebsiteMock.mockResolvedValue([
      {
        ...preparedTitleAction(),
        status: "approved" as const,
        proposedValue: "Unique title | DBHobby",
      },
    ]);
    const { actions } = await listActionsForWebsite({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
    });
    expect(actions[0]?.actionType).toBe("update_page_title");
    expect(actions[0]?.executeAvailable).toBe(false);
    expect(actions[0]?.executeBlockedReason).toBe("adapter_not_connected");
    expect(actions[0]?.verification).toBeNull();
    expect(actions[0]?.learning).toBeNull();
  });

  it("cancels a prepared title action", async () => {
    findActionByIdMock.mockResolvedValue(preparedTitleAction());
    updateActionMock.mockResolvedValue({ ...preparedTitleAction(), status: "cancelled" });
    const preview = await cancelAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      actionId: "action-title",
    });
    expect(preview.status).toBe("cancelled");
  });

  it("returns the existing open title action instead of inserting a duplicate", async () => {
    findOpenActionForDecisionMock.mockResolvedValue(preparedTitleAction());
    const preview = await prepareAction({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
      decisionId: "decision-c",
    });
    expect(preview.id).toBe("action-title");
    expect(insertActionMock).not.toHaveBeenCalled();
  });
  });
});

describe("ActionError", () => {
  it("keeps adapter_not_connected distinct from success", () => {
    const error = new ActionError(
      "adapter_not_connected",
      "Foundfy cannot apply this change until a site connection exists.",
    );
    expect(error.code).toBe("adapter_not_connected");
    expect(error.status).toBe(409);
  });
});
