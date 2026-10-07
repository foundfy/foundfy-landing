import { afterEach, describe, expect, it, vi } from "vitest";

const findLatestVerificationForActionMock = vi.fn();
const findLearningByIdempotencyMock = vi.fn();
const insertActionLearningSnapshotMock = vi.fn();
const findSearchSyncByIdMock = vi.fn();
const listCompletedSearchSyncsForWebsiteMock = vi.fn();
const listEvidenceForSyncMock = vi.fn();

vi.mock("./db", () => ({
  findLatestVerificationForAction: (...args: unknown[]) => findLatestVerificationForActionMock(...args),
  findLearningByIdempotency: (...args: unknown[]) => findLearningByIdempotencyMock(...args),
  insertActionLearningSnapshot: (...args: unknown[]) => insertActionLearningSnapshotMock(...args),
}));

vi.mock("@/lib/gsc/db-search", () => ({
  findSearchSyncById: (...args: unknown[]) => findSearchSyncByIdMock(...args),
  listCompletedSearchSyncsForWebsite: (...args: unknown[]) =>
    listCompletedSearchSyncsForWebsiteMock(...args),
  listEvidenceForSync: (...args: unknown[]) => listEvidenceForSyncMock(...args),
}));

import { learningViewFor } from "./learn";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const TARGET = "https://www.foundfy.me/";
const fetchSpy = vi.spyOn(globalThis, "fetch");

function action(overrides: Record<string, unknown> = {}) {
  return {
    id: "action-1",
    websiteId: WEBSITE_ID,
    decisionId: "decision-1",
    decisionRunId: "run-1",
    ownerId: "owner-1",
    actionType: "update_meta_description" as const,
    targetPageId: "page-1",
    targetPageUrl: TARGET,
    field: "meta_description" as const,
    observedBefore: null,
    proposedValue: "Foundfy turns on-page SEO insights into clear actions.",
    mutationSpec: {
      targetUrl: TARGET,
      field: "meta_description" as const,
      before: null,
      after: "Foundfy turns on-page SEO insights into clear actions.",
    },
    pageContentHashAtPrepare: "hash-1",
    crawlRunId: "crawl-1",
    gscSyncId: "sync-baseline",
    siteModelId: "site-model-1",
    goalId: "goal-1",
    status: "executed" as const,
    approvedByOwnerId: "owner-1",
    approvedAt: "2026-10-04T10:00:00.000Z",
    createdAt: "2026-10-04T09:00:00.000Z",
    updatedAt: "2026-10-04T10:05:00.000Z",
    evidenceRefs: [
      {
        kind: "gsc_evidence" as const,
        recordId: "gsc-1",
        snapshot: { pageUrl: TARGET, impressions: 120, clicks: 4 },
      },
    ],
    ...overrides,
  };
}

function verified() {
  return {
    id: "verification-1",
    actionId: "action-1",
    websiteId: WEBSITE_ID,
    executionAttemptId: "attempt-1",
    crawlRunId: "crawl-after",
    targetPageId: "page-after",
    verificationType: "update_meta_description" as const,
    status: "verified" as const,
    expectedValue: "Foundfy turns on-page SEO insights into clear actions.",
    observedValue: "Foundfy turns on-page SEO insights into clear actions.",
    evidenceSnapshot: {},
    verifiedAt: "2026-10-06T20:58:27.000Z",
    createdAt: "2026-10-06T20:58:27.000Z",
  };
}

function sync(id: string, periodStart: string, periodEnd: string, completedAt: string) {
  return {
    id,
    websiteId: WEBSITE_ID,
    propertyConnectionId: "connection-1",
    periodStart,
    periodEnd,
    status: "completed" as const,
    source: "google_search_console_search_analytics" as const,
    startedAt: completedAt,
    completedAt,
    errorCode: null,
    siteRowCount: 1,
    pageRowCount: 8,
    queryRowCount: 8,
    queryPageRowCount: 8,
    pagesTruncated: false,
    queriesTruncated: false,
    queryPagesTruncated: false,
  };
}

function pageEvidence(pageUrl: string, impressions: number, clicks: number) {
  return {
    id: `gsc-${pageUrl}`,
    syncId: "sync",
    websiteId: WEBSITE_ID,
    propertyConnectionId: "connection-1",
    evidenceType: "page" as const,
    pageUrl,
    pageId: "page-ignored",
    queryText: null,
    clicks,
    impressions,
    ctr: impressions === 0 ? 0 : clicks / impressions,
    position: 12,
    periodStart: "2026-09-09",
    periodEnd: "2026-10-06",
    retrievedAt: "2026-10-06T00:00:00.000Z",
  };
}

afterEach(() => {
  vi.clearAllMocks();
  fetchSpy.mockReset();
});

describe("learningViewFor", () => {
  it("has no LEARN state until the latest verification is verified", async () => {
    expect(await learningViewFor({ ...action(), status: "approved" })).toBeNull();
    findLatestVerificationForActionMock.mockResolvedValue({ ...verified(), status: "not_verified" });
    expect(await learningViewFor(action())).toBeNull();
    expect(
      await learningViewFor({
        ...action(),
        actionType: "update_page_title",
        field: "title",
      }),
    ).toBeNull();
  });

  it("waits when there is no eligible later GSC sync", async () => {
    findLatestVerificationForActionMock.mockResolvedValue(verified());
    findSearchSyncByIdMock.mockResolvedValue(sync("sync-baseline", "2026-09-09", "2026-10-06", "2026-10-04T00:00:00.000Z"));
    listEvidenceForSyncMock.mockResolvedValue([pageEvidence(TARGET, 120, 4)]);
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([]);

    expect(await learningViewFor(action())).toMatchObject({ state: "waiting_for_data" });
    expect(insertActionLearningSnapshotMock).not.toHaveBeenCalled();
  });

  it("waits when the only later window still overlaps verification", async () => {
    findLatestVerificationForActionMock.mockResolvedValue(verified());
    findSearchSyncByIdMock.mockResolvedValue(sync("sync-baseline", "2026-09-09", "2026-10-06", "2026-10-04T00:00:00.000Z"));
    listEvidenceForSyncMock.mockResolvedValue([pageEvidence(TARGET, 120, 4)]);
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      sync("sync-overlap", "2026-09-23", "2026-10-20", "2026-10-20T00:00:00.000Z"),
    ]);

    expect(await learningViewFor(action())).toMatchObject({ state: "waiting_for_data" });
  });

  it("is insufficient when the baseline page is missing", async () => {
    findLatestVerificationForActionMock.mockResolvedValue(verified());
    findSearchSyncByIdMock.mockResolvedValue(sync("sync-baseline", "2026-09-09", "2026-10-06", "2026-10-04T00:00:00.000Z"));
    listEvidenceForSyncMock.mockResolvedValue([]);

    expect(await learningViewFor(action())).toMatchObject({
      state: "insufficient_data",
      reason: "missing_baseline_page",
    });
    expect(insertActionLearningSnapshotMock).not.toHaveBeenCalled();
  });

  it("is insufficient when the comparison page is missing", async () => {
    findLatestVerificationForActionMock.mockResolvedValue(verified());
    findSearchSyncByIdMock.mockResolvedValue(sync("sync-baseline", "2026-09-09", "2026-10-06", "2026-10-04T00:00:00.000Z"));
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      sync("sync-later", "2026-10-07", "2026-11-03", "2026-11-03T00:00:00.000Z"),
    ]);
    listEvidenceForSyncMock
      .mockResolvedValueOnce([pageEvidence(TARGET, 120, 4)])
      .mockResolvedValueOnce([]);
    findLearningByIdempotencyMock.mockResolvedValue(null);
    insertActionLearningSnapshotMock.mockImplementation(async (input: { outcomeState: string }) => ({
      ...input,
      id: "learn-1",
      createdAt: "2026-11-03T00:00:00.000Z",
    }));

    expect(await learningViewFor(action())).toMatchObject({
      state: "insufficient_data",
      reason: "missing_comparison_page",
      comparison: null,
    });
  });

  it("is insufficient after Google evidence is removed", async () => {
    findLatestVerificationForActionMock.mockResolvedValue(verified());
    expect(await learningViewFor(action({ gscSyncId: null }))).toMatchObject({
      state: "insufficient_data",
      reason: "google_evidence_removed",
    });
  });

  it("does not treat a truncated missing comparison page as zero", async () => {
    findLatestVerificationForActionMock.mockResolvedValue(verified());
    findSearchSyncByIdMock.mockResolvedValue(sync("sync-baseline", "2026-09-09", "2026-10-06", "2026-10-04T00:00:00.000Z"));
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      {
        ...sync("sync-later", "2026-10-07", "2026-11-03", "2026-11-03T00:00:00.000Z"),
        pagesTruncated: true,
      },
    ]);
    listEvidenceForSyncMock
      .mockResolvedValueOnce([pageEvidence(TARGET, 120, 4)])
      .mockResolvedValueOnce([]);
    findLearningByIdempotencyMock.mockResolvedValue(null);
    insertActionLearningSnapshotMock.mockImplementation(async (input: { outcomeState: string }) => ({
      ...input,
      id: "learn-1",
      createdAt: "2026-11-03T00:00:00.000Z",
    }));

    expect(await learningViewFor(action())).toMatchObject({
      state: "insufficient_data",
      reason: "truncated_page_dataset",
      comparison: null,
    });
  });

  it("is insufficient when Google's reported URL identity changes", async () => {
    findLatestVerificationForActionMock.mockResolvedValue(verified());
    expect(
      await learningViewFor(
        action({
          evidenceRefs: [
            {
              kind: "gsc_evidence",
              recordId: "gsc-1",
              snapshot: { pageUrl: "https://www.foundfy.me/home", impressions: 120, clicks: 4 },
            },
          ],
        }),
      ),
    ).toMatchObject({
      state: "insufficient_data",
      reason: "url_identity_changed",
    });
  });

  it("persists improvement without calling Google, crawler, GitHub, or OpenAI", async () => {
    findLatestVerificationForActionMock.mockResolvedValue(verified());
    findSearchSyncByIdMock.mockResolvedValue(sync("sync-baseline", "2026-09-09", "2026-10-06", "2026-10-04T00:00:00.000Z"));
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      sync("sync-later", "2026-10-07", "2026-11-03", "2026-11-03T00:00:00.000Z"),
    ]);
    listEvidenceForSyncMock
      .mockResolvedValueOnce([pageEvidence("https://foundfy.me/", 120, 4)])
      .mockResolvedValueOnce([pageEvidence("http://www.foundfy.me", 147, 6)]);
    findLearningByIdempotencyMock.mockResolvedValue(null);
    insertActionLearningSnapshotMock.mockImplementation(async (input: { outcomeState: string }) => ({
      ...input,
      id: "learn-1",
      createdAt: "2026-11-03T00:00:00.000Z",
    }));

    const view = await learningViewFor(action());
    expect(view).toMatchObject({
      state: "observed_improvement",
      baseline: { appearances: 120, visits: 4 },
      comparison: { appearances: 147, visits: 6 },
    });
    expect(insertActionLearningSnapshotMock).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reuses the same comparison sync snapshot", async () => {
    findLatestVerificationForActionMock.mockResolvedValue(verified());
    findSearchSyncByIdMock.mockResolvedValue(sync("sync-baseline", "2026-09-09", "2026-10-06", "2026-10-04T00:00:00.000Z"));
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      sync("sync-later", "2026-10-07", "2026-11-03", "2026-11-03T00:00:00.000Z"),
    ]);
    listEvidenceForSyncMock.mockResolvedValue([pageEvidence(TARGET, 120, 4)]);
    findLearningByIdempotencyMock.mockResolvedValue({
      id: "learn-1",
      actionId: "action-1",
      verificationId: "verification-1",
      websiteId: WEBSITE_ID,
      pageUrl: TARGET,
      pageComparisonKey: "https://foundfy.me/",
      baselineSyncId: "sync-baseline",
      comparisonSyncId: "sync-later",
      baselinePeriodStart: "2026-09-09",
      baselinePeriodEnd: "2026-10-06",
      comparisonPeriodStart: "2026-10-07",
      comparisonPeriodEnd: "2026-11-03",
      baselineAppearances: 120,
      baselineVisits: 4,
      baselineCtr: 0.033,
      baselinePosition: 12,
      comparisonAppearances: 147,
      comparisonVisits: 6,
      comparisonCtr: 0.04,
      comparisonPosition: 11,
      baselinePagesTruncated: false,
      comparisonPagesTruncated: false,
      outcomeState: "observed_improvement",
      insufficientReason: null,
      calculationVersion: "learn_v0",
      createdAt: "2026-11-03T00:00:00.000Z",
    });

    const first = await learningViewFor(action());
    const second = await learningViewFor(action());
    expect(first.state).toBe("observed_improvement");
    expect(second.state).toBe("observed_improvement");
    expect(insertActionLearningSnapshotMock).not.toHaveBeenCalled();
  });

  it("can persist a newer snapshot from a later eligible sync", async () => {
    findLatestVerificationForActionMock.mockResolvedValue(verified());
    findSearchSyncByIdMock.mockResolvedValue(sync("sync-baseline", "2026-09-09", "2026-10-06", "2026-10-04T00:00:00.000Z"));
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      sync("sync-newest", "2026-10-14", "2026-11-10", "2026-11-10T00:00:00.000Z"),
    ]);
    listEvidenceForSyncMock
      .mockResolvedValueOnce([pageEvidence(TARGET, 120, 4)])
      .mockResolvedValueOnce([pageEvidence(TARGET, 90, 2)]);
    findLearningByIdempotencyMock.mockResolvedValue(null);
    insertActionLearningSnapshotMock.mockImplementation(async (input: { comparisonSyncId: string; outcomeState: string }) => ({
      ...input,
      id: "learn-2",
      createdAt: "2026-11-10T00:00:00.000Z",
    }));

    expect(await learningViewFor(action())).toMatchObject({
      state: "observed_decline",
    });
    expect(insertActionLearningSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({ comparisonSyncId: "sync-newest", outcomeState: "observed_decline" }),
    );
  });

  it("persists mixed and no meaningful change without using CTR or position", async () => {
    findLatestVerificationForActionMock.mockResolvedValue(verified());
    findSearchSyncByIdMock.mockResolvedValue(sync("sync-baseline", "2026-09-09", "2026-10-06", "2026-10-04T00:00:00.000Z"));
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      sync("sync-later", "2026-10-07", "2026-11-03", "2026-11-03T00:00:00.000Z"),
    ]);
    findLearningByIdempotencyMock.mockResolvedValue(null);
    insertActionLearningSnapshotMock.mockImplementation(async (input: { outcomeState: string }) => ({
      ...input,
      id: "learn-mixed",
      createdAt: "2026-11-03T00:00:00.000Z",
    }));

    listEvidenceForSyncMock
      .mockResolvedValueOnce([{ ...pageEvidence(TARGET, 120, 6), ctr: 0.05, position: 8 }])
      .mockResolvedValueOnce([{ ...pageEvidence(TARGET, 147, 4), ctr: 0.9, position: 2 }]);
    expect(await learningViewFor(action())).toMatchObject({ state: "mixed" });

    listEvidenceForSyncMock
      .mockResolvedValueOnce([{ ...pageEvidence(TARGET, 120, 4), ctr: 0.03, position: 12 }])
      .mockResolvedValueOnce([{ ...pageEvidence(TARGET, 125, 5), ctr: 0.8, position: 1 }]);
    expect(await learningViewFor(action())).toMatchObject({ state: "no_meaningful_change" });
  });
});
