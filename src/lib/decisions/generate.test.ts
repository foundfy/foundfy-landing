import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObserveAuthError } from "@/lib/gsc/types";
import { DecisionPrerequisiteError } from "./types";

const requireObserveOwnerMock = vi.fn();
const findActivePropertyConnectionMock = vi.fn();
const findLatestCompletedSearchSyncMock = vi.fn();
const listEvidenceForSyncMock = vi.fn();
const findWebsiteGoalsMock = vi.fn();
const findLatestConfirmedSiteModelForWebsiteMock = vi.fn();
const findLatestUsableCrawlRunMock = vi.fn();
const listObservationsMock = vi.fn();
const listPrioritiesMock = vi.fn();
const insertRunningDecisionRunMock = vi.fn();
const completeDecisionRunMock = vi.fn();
const failDecisionRunMock = vi.fn();
const markWebsiteDecisionRunsStaleMock = vi.fn();

vi.mock("@/lib/gsc/observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwnerMock(...args),
}));

vi.mock("@/lib/gsc/db", () => ({
  findActivePropertyConnection: (...args: unknown[]) => findActivePropertyConnectionMock(...args),
}));

vi.mock("@/lib/gsc/db-search", () => ({
  findLatestCompletedSearchSync: (...args: unknown[]) => findLatestCompletedSearchSyncMock(...args),
  listEvidenceForSync: (...args: unknown[]) => listEvidenceForSyncMock(...args),
}));

vi.mock("@/lib/goals/repository", () => ({
  findWebsiteGoals: (...args: unknown[]) => findWebsiteGoalsMock(...args),
}));

vi.mock("@/lib/site-model/repository", () => ({
  findLatestConfirmedSiteModelForWebsite: (...args: unknown[]) =>
    findLatestConfirmedSiteModelForWebsiteMock(...args),
}));

vi.mock("@/lib/websites/repository", () => ({
  findLatestUsableCrawlRun: (...args: unknown[]) => findLatestUsableCrawlRunMock(...args),
}));

vi.mock("@/lib/observations/db/repository", () => ({
  listObservations: (...args: unknown[]) => listObservationsMock(...args),
}));

vi.mock("@/lib/priorities/db/repository", () => ({
  listPriorities: (...args: unknown[]) => listPrioritiesMock(...args),
}));

vi.mock("./db", () => ({
  insertRunningDecisionRun: (...args: unknown[]) => insertRunningDecisionRunMock(...args),
  completeDecisionRun: (...args: unknown[]) => completeDecisionRunMock(...args),
  failDecisionRun: (...args: unknown[]) => failDecisionRunMock(...args),
  markWebsiteDecisionRunsStale: (...args: unknown[]) => markWebsiteDecisionRunsStaleMock(...args),
}));

import { generateDecisionsForWebsite, loadDecisionPrerequisites } from "./generate";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const SESSION = "owner-session-token";

function ownerContext() {
  return {
    website: { id: WEBSITE_ID },
    owner: { id: "owner-1", googleIdentityId: "identity-1" },
    session: { id: "session-1", websiteId: WEBSITE_ID, googleIdentityId: "identity-1" },
  };
}

describe("Decision Engine generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireObserveOwnerMock.mockResolvedValue(ownerContext());
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "site-model-1",
      confirmed: { pages: [] },
      status: "confirmed",
    });
    findWebsiteGoalsMock.mockResolvedValue({
      id: "goal-1",
      primaryType: "grow_signups",
      secondaryType: null,
      note: null,
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
    findLatestUsableCrawlRunMock.mockResolvedValue({ id: "crawl-1" });
    findActivePropertyConnectionMock.mockResolvedValue({
      id: "connection-1",
      status: "connected",
      googleIdentityId: "identity-1",
    });
    findLatestCompletedSearchSyncMock.mockResolvedValue({
      id: "sync-1",
      periodStart: "2026-08-27",
      periodEnd: "2026-09-23",
      pageRowCount: 1,
      pagesTruncated: false,
      queriesTruncated: false,
      queryPagesTruncated: false,
    });
    listEvidenceForSyncMock.mockResolvedValue([
      {
        id: "gsc-1",
        evidenceType: "page",
        pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
        pageId: "page-1",
        clicks: 26,
        impressions: 153,
        ctr: 0.17,
        position: 8.2,
        queryText: null,
      },
      {
        id: "gsc-query",
        evidenceType: "query",
        pageUrl: null,
        pageId: null,
        clicks: 80,
        impressions: 900,
        ctr: 0.09,
        position: 4.1,
        queryText: "pintura en seda",
      },
    ]);
    listObservationsMock.mockResolvedValue([
      {
        id: "obs-1",
        pageId: "page-1",
        pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
        ruleKey: "page_fundamentals.missing_title",
        title: "Missing page title",
        description: "The page does not have a title element.",
        severity: "error",
        status: "active",
        evidence: {},
      },
    ]);
    listPrioritiesMock.mockResolvedValue([
      { observationId: "obs-1", priorityLevel: "high", priorityScore: 80 },
    ]);
    insertRunningDecisionRunMock.mockResolvedValue({ id: "run-1" });
    completeDecisionRunMock.mockImplementation(async (input: { id: string; decisions: unknown[] }) => ({
      run: { id: input.id },
      decisions: input.decisions,
    }));
    markWebsiteDecisionRunsStaleMock.mockResolvedValue(undefined);
    failDecisionRunMock.mockResolvedValue(undefined);
  });

  it("requires an owner session", async () => {
    requireObserveOwnerMock.mockRejectedValue(new ObserveAuthError(401, "Owner session required."));

    await expect(
      loadDecisionPrerequisites({ websiteId: WEBSITE_ID, sessionToken: null }),
    ).rejects.toBeInstanceOf(ObserveAuthError);
  });

  it("denies a session that is not the observe owner", async () => {
    requireObserveOwnerMock.mockRejectedValue(new ObserveAuthError(403, "Not authorized."));

    await expect(
      loadDecisionPrerequisites({ websiteId: WEBSITE_ID, sessionToken: SESSION }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("requires a Goal", async () => {
    findWebsiteGoalsMock.mockResolvedValue(null);

    await expect(
      loadDecisionPrerequisites({ websiteId: WEBSITE_ID, sessionToken: SESSION }),
    ).rejects.toMatchObject({ reason: "missing_goal" });
  });

  it("requires a usable Site Model", async () => {
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "site-model-draft",
      confirmed: null,
      status: "draft",
    });

    await expect(
      loadDecisionPrerequisites({ websiteId: WEBSITE_ID, sessionToken: SESSION }),
    ).rejects.toMatchObject({ reason: "missing_site_model" });
  });

  it("requires a completed crawl", async () => {
    findLatestUsableCrawlRunMock.mockResolvedValue(null);

    await expect(
      loadDecisionPrerequisites({ websiteId: WEBSITE_ID, sessionToken: SESSION }),
    ).rejects.toMatchObject({ reason: "missing_crawl" });
  });

  it("requires a Search Console connection", async () => {
    findActivePropertyConnectionMock.mockResolvedValue(null);

    await expect(
      loadDecisionPrerequisites({ websiteId: WEBSITE_ID, sessionToken: SESSION }),
    ).rejects.toMatchObject({ reason: "google_not_connected" });
  });

  it("requires a completed GSC sync", async () => {
    findLatestCompletedSearchSyncMock.mockResolvedValue(null);

    await expect(
      loadDecisionPrerequisites({ websiteId: WEBSITE_ID, sessionToken: SESSION }),
    ).rejects.toMatchObject({ reason: "missing_gsc_sync" });
  });

  it("does not create a decision run when a Site Model is missing", async () => {
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "site-model-draft",
      confirmed: null,
      status: "draft",
    });

    await expect(
      generateDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: SESSION }),
    ).rejects.toBeInstanceOf(DecisionPrerequisiteError);
    expect(insertRunningDecisionRunMock).not.toHaveBeenCalled();
    expect(completeDecisionRunMock).not.toHaveBeenCalled();
  });

  it("does not create a decision run when a Goal is missing", async () => {
    findWebsiteGoalsMock.mockResolvedValue(null);

    await expect(
      generateDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: SESSION }),
    ).rejects.toMatchObject({ reason: "missing_goal" });
    expect(insertRunningDecisionRunMock).not.toHaveBeenCalled();
  });

  it("does not create a decision run when Google is not connected", async () => {
    findActivePropertyConnectionMock.mockResolvedValue(null);

    await expect(
      generateDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: SESSION }),
    ).rejects.toMatchObject({ reason: "google_not_connected" });
    expect(insertRunningDecisionRunMock).not.toHaveBeenCalled();
  });

  it("does not create a decision run when Search Console has never synced", async () => {
    findLatestCompletedSearchSyncMock.mockResolvedValue(null);

    await expect(
      generateDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: SESSION }),
    ).rejects.toMatchObject({ reason: "missing_gsc_sync" });
    expect(insertRunningDecisionRunMock).not.toHaveBeenCalled();
  });

  it("persists ranked decisions with GSC page evidence and ignores query rows", async () => {
    const result = await generateDecisionsForWebsite({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
    });

    expect(completeDecisionRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "run-1",
        websiteId: WEBSITE_ID,
      }),
    );
    const stored = completeDecisionRunMock.mock.calls[0][0] as {
      decisions: Array<{ decisionType: string; evidenceRefs: Array<{ kind: string; snapshot: Record<string, unknown> }> }>;
    };
    expect(stored.decisions).toHaveLength(1);
    expect(stored.decisions[0].decisionType).toBe("existing_demand_page_issue");
    expect(stored.decisions[0].evidenceRefs.some((ref) => ref.snapshot.queryText)).toBe(false);
    expect(result.decisions).toHaveLength(1);
    expect(markWebsiteDecisionRunsStaleMock).toHaveBeenCalledWith(WEBSITE_ID, "run-1");
  });

  it("completes an empty run when GSC page evidence is empty", async () => {
    listEvidenceForSyncMock.mockResolvedValue([]);

    await generateDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: SESSION });

    expect(insertRunningDecisionRunMock).toHaveBeenCalled();
    const stored = completeDecisionRunMock.mock.calls[0][0] as { decisions: unknown[] };
    expect(stored.decisions).toEqual([]);
  });

  it("persists a completed run when GSC pages exist but candidates are empty", async () => {
    listObservationsMock.mockResolvedValue([]);
    listPrioritiesMock.mockResolvedValue([]);

    await generateDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: SESSION });

    expect(insertRunningDecisionRunMock).toHaveBeenCalled();
    const stored = completeDecisionRunMock.mock.calls[0][0] as { decisions: unknown[] };
    expect(stored.decisions).toEqual([]);
    expect(completeDecisionRunMock).toHaveBeenCalled();
  });

  it("marks a failed run failed and does not complete it", async () => {
    completeDecisionRunMock.mockRejectedValue(new Error("db down"));

    await expect(
      generateDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: SESSION }),
    ).rejects.toThrow("db down");

    expect(failDecisionRunMock).toHaveBeenCalledWith("run-1", "unavailable");
  });

  it("does not create observations, findings, or jobs", async () => {
    await generateDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: SESSION });

    expect(listObservationsMock).toHaveBeenCalledWith("crawl-1");
    expect(JSON.stringify(completeDecisionRunMock.mock.calls)).not.toMatch(/findings|jobs|openai/i);
  });
});
