import { beforeEach, describe, expect, it, vi } from "vitest";
import { DecisionPrerequisiteError } from "./types";

const loadDecisionPrerequisitesMock = vi.fn();
const findLatestCompletedDecisionRunMock = vi.fn();
const listDecisionsForRunMock = vi.fn();

vi.mock("./generate", () => ({
  loadDecisionPrerequisites: (...args: unknown[]) => loadDecisionPrerequisitesMock(...args),
  generateDecisionsForWebsite: vi.fn(),
}));

vi.mock("./db", () => ({
  findLatestCompletedDecisionRun: (...args: unknown[]) => findLatestCompletedDecisionRunMock(...args),
  listDecisionsForRun: (...args: unknown[]) => listDecisionsForRunMock(...args),
}));

import { generateDecisionsForWebsite } from "./generate";
import { loadDecisionsForWebsite } from "./load";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const generateDecisionsForWebsiteMock = vi.mocked(generateDecisionsForWebsite);

function readyPrerequisites(pageRowCount = 2) {
  return {
    siteModel: { id: "site-model-1" },
    crawl: { id: "crawl-1" },
    sync: { id: "sync-1", pageRowCount },
    goal: {
      id: "goal-1",
      primaryType: "grow_signups",
      secondaryType: null,
      note: null,
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
  };
}

function completedRun() {
  return {
    id: "run-1",
    siteModelId: "site-model-1",
    crawlRunId: "crawl-1",
    gscSearchSyncId: "sync-1",
    engineVersion: "decision_v1",
    goalSnapshot: {
      id: "goal-1",
      primaryType: "grow_signups",
      secondaryType: null,
      note: null,
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
    gscTruncated: false,
    createdAt: "2026-09-24T00:00:00.000Z",
    completedAt: "2026-09-24T00:00:01.000Z",
  };
}

function rankedDecision() {
  return {
    id: "decision-1",
    decisionRunId: "run-1",
    websiteId: WEBSITE_ID,
    decisionType: "existing_demand_page_issue",
    title: "Improve the page title on /es/pintura-en-seda",
    explanation:
      "This page already appears in Google Search, and Foundfy found a missing page title on the same page.",
    pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
    pageId: "page-1",
    priorityBand: "do_first",
    rank: 1,
    scoring: { issueImportance: 80, searchDemand: 100, evidenceConfidence: 90, total: 88 },
    confidence: "exact_match",
    createdAt: "2026-09-24T00:00:00.000Z",
    evidenceRefs: [
      {
        kind: "gsc_evidence",
        recordId: "gsc-1",
        snapshot: { impressions: 153, clicks: 26 },
      },
      {
        kind: "gsc_sync",
        recordId: "sync-1",
        snapshot: { periodStart: "2026-08-27", periodEnd: "2026-09-23" },
      },
      {
        kind: "observation",
        recordId: "obs-1",
        snapshot: { title: "Missing page title" },
      },
    ],
  };
}

describe("loadDecisionsForWebsite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listDecisionsForRunMock.mockResolvedValue([]);
  });

  it("returns not_generated without creating a run", async () => {
    loadDecisionPrerequisitesMock.mockResolvedValue(readyPrerequisites());
    findLatestCompletedDecisionRunMock.mockResolvedValue(null);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });

    expect(view).toMatchObject({
      status: "not_generated",
      current: false,
      canGenerate: true,
      blockedReason: null,
      emptyReason: null,
      run: null,
      decisions: [],
    });
    expect(generateDecisionsForWebsiteMock).not.toHaveBeenCalled();
  });

  it("does not treat a missing completed run as current when generation failed", async () => {
    loadDecisionPrerequisitesMock.mockResolvedValue(readyPrerequisites());
    findLatestCompletedDecisionRunMock.mockResolvedValue(null);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });
    expect(view.current).toBe(false);
    expect(view.status).toBe("not_generated");
    expect(generateDecisionsForWebsiteMock).not.toHaveBeenCalled();
  });

  it("blocks when a usable Site Model is missing", async () => {
    loadDecisionPrerequisitesMock.mockRejectedValue(
      new DecisionPrerequisiteError(
        "missing_site_model",
        "Confirm how Foundfy understands this site before prioritizing actions.",
      ),
    );
    findLatestCompletedDecisionRunMock.mockResolvedValue(null);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });

    expect(view).toMatchObject({
      status: "blocked",
      canGenerate: false,
      blockedReason: "missing_site_model",
      emptyReason: null,
      run: null,
    });
  });

  it("blocks when a Goal is missing", async () => {
    loadDecisionPrerequisitesMock.mockRejectedValue(
      new DecisionPrerequisiteError(
        "missing_goal",
        "Tell Foundfy what should happen when the right people find this site before prioritizing actions.",
      ),
    );
    findLatestCompletedDecisionRunMock.mockResolvedValue(null);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });

    expect(view).toMatchObject({
      status: "blocked",
      canGenerate: false,
      blockedReason: "missing_goal",
      emptyReason: null,
    });
  });

  it("blocks when Google Search is not connected", async () => {
    loadDecisionPrerequisitesMock.mockRejectedValue(
      new DecisionPrerequisiteError(
        "google_not_connected",
        "Connect Google Search before Foundfy can combine search demand with website evidence.",
      ),
    );
    findLatestCompletedDecisionRunMock.mockResolvedValue(null);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });

    expect(view).toMatchObject({
      status: "blocked",
      canGenerate: false,
      blockedReason: "google_not_connected",
      emptyReason: null,
    });
  });

  it("blocks when Search Console is connected but has never synced", async () => {
    loadDecisionPrerequisitesMock.mockRejectedValue(
      new DecisionPrerequisiteError(
        "missing_gsc_sync",
        "Sync Google search data before Foundfy can prioritize cross-signal actions.",
      ),
    );
    findLatestCompletedDecisionRunMock.mockResolvedValue(null);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });

    expect(view).toMatchObject({
      status: "blocked",
      canGenerate: false,
      blockedReason: "missing_gsc_sync",
      emptyReason: null,
    });
  });

  it("treats a completed empty GSC sync as empty evidence, not a missing sync", async () => {
    loadDecisionPrerequisitesMock.mockResolvedValue(readyPrerequisites(0));
    findLatestCompletedDecisionRunMock.mockResolvedValue(null);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });

    expect(view).toMatchObject({
      status: "empty",
      canGenerate: true,
      blockedReason: null,
      emptyReason: "empty_gsc_evidence",
      run: null,
    });
    expect(generateDecisionsForWebsiteMock).not.toHaveBeenCalled();
  });

  it("reports no_cross_signal_candidates only after a completed zero-decision run", async () => {
    loadDecisionPrerequisitesMock.mockResolvedValue(readyPrerequisites(2));
    findLatestCompletedDecisionRunMock.mockResolvedValue(completedRun());
    listDecisionsForRunMock.mockResolvedValue([]);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });

    expect(view).toMatchObject({
      status: "empty",
      canGenerate: true,
      blockedReason: null,
      emptyReason: "no_cross_signal_candidates",
      run: { id: "run-1" },
      decisions: [],
    });
  });

  it("keeps empty GSC evidence distinct after a completed zero-decision run", async () => {
    loadDecisionPrerequisitesMock.mockResolvedValue(readyPrerequisites(0));
    findLatestCompletedDecisionRunMock.mockResolvedValue(completedRun());
    listDecisionsForRunMock.mockResolvedValue([]);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });

    expect(view).toMatchObject({
      status: "empty",
      emptyReason: "empty_gsc_evidence",
      run: { id: "run-1" },
    });
  });

  it("still renders existing decisions", async () => {
    loadDecisionPrerequisitesMock.mockResolvedValue(readyPrerequisites());
    findLatestCompletedDecisionRunMock.mockResolvedValue(completedRun());
    listDecisionsForRunMock.mockResolvedValue([rankedDecision()]);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });

    expect(view.status).toBe("completed");
    expect(view.emptyReason).toBeNull();
    expect(view.decisions).toHaveLength(1);
    expect(view.decisions[0].why.searchDemand).toEqual({ appearances: 153, visits: 26 });
  });

  it("marks a completed run stale when a new crawl is current", async () => {
    loadDecisionPrerequisitesMock.mockResolvedValue({
      ...readyPrerequisites(),
      crawl: { id: "crawl-2" },
    });
    findLatestCompletedDecisionRunMock.mockResolvedValue(completedRun());
    listDecisionsForRunMock.mockResolvedValue([rankedDecision()]);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });

    expect(view.current).toBe(false);
    expect(view.staleReason).toBe("crawl");
    expect(view.canGenerate).toBe(true);
    expect(view.decisions).toHaveLength(1);
  });
});
