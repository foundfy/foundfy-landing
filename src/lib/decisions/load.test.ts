import { beforeEach, describe, expect, it, vi } from "vitest";
import { DecisionPrerequisiteError } from "./types";

const loadDecisionPrerequisitesMock = vi.fn();
const findLatestCompletedDecisionRunMock = vi.fn();
const listDecisionsForRunMock = vi.fn();

vi.mock("./generate", () => ({
  loadDecisionPrerequisites: (...args: unknown[]) => loadDecisionPrerequisitesMock(...args),
}));

vi.mock("./db", () => ({
  findLatestCompletedDecisionRun: (...args: unknown[]) => findLatestCompletedDecisionRunMock(...args),
  listDecisionsForRun: (...args: unknown[]) => listDecisionsForRunMock(...args),
}));

import { loadDecisionsForWebsite } from "./load";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

describe("loadDecisionsForWebsite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listDecisionsForRunMock.mockResolvedValue([]);
  });

  it("returns not_generated without creating a run", async () => {
    loadDecisionPrerequisitesMock.mockResolvedValue({
      siteModel: { id: "site-model-1" },
      crawl: { id: "crawl-1" },
      sync: { id: "sync-1", pageRowCount: 2 },
      goal: {
        id: "goal-1",
        primaryType: "grow_signups",
        secondaryType: null,
        note: null,
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    });
    findLatestCompletedDecisionRunMock.mockResolvedValue(null);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });

    expect(view).toMatchObject({
      status: "not_generated",
      current: false,
      canGenerate: true,
      decisions: [],
    });
  });

  it("does not treat a missing completed run as current when generation failed", async () => {
    loadDecisionPrerequisitesMock.mockResolvedValue({
      siteModel: { id: "site-model-1" },
      crawl: { id: "crawl-1" },
      sync: { id: "sync-1", pageRowCount: 2 },
      goal: {
        id: "goal-1",
        primaryType: "grow_signups",
        secondaryType: null,
        note: null,
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    });
    findLatestCompletedDecisionRunMock.mockResolvedValue(null);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });
    expect(view.current).toBe(false);
    expect(view.status).toBe("not_generated");
  });

  it("reports truthful empty GSC evidence without inventing work", async () => {
    loadDecisionPrerequisitesMock.mockRejectedValue(
      new DecisionPrerequisiteError("missing_gsc_sync", "Google Search evidence is required."),
    );
    findLatestCompletedDecisionRunMock.mockResolvedValue(null);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });

    expect(view.canGenerate).toBe(false);
    expect(view.emptyReason).toBe("no_gsc_evidence");
  });

  it("marks a completed run stale when a new crawl is current", async () => {
    loadDecisionPrerequisitesMock.mockResolvedValue({
      siteModel: { id: "site-model-1" },
      crawl: { id: "crawl-2" },
      sync: { id: "sync-1", pageRowCount: 2 },
      goal: {
        id: "goal-1",
        primaryType: "grow_signups",
        secondaryType: null,
        note: null,
        updatedAt: "2026-09-01T00:00:00.000Z",
      },
    });
    findLatestCompletedDecisionRunMock.mockResolvedValue({
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
    });
    listDecisionsForRunMock.mockResolvedValue([
      {
        id: "decision-1",
        decisionRunId: "run-1",
        websiteId: WEBSITE_ID,
        decisionType: "existing_demand_page_issue",
        title: "Improve the page title on /es/pintura-en-seda",
        explanation: "This page already appears in Google Search, and Foundfy found a missing page title on the same page.",
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
      },
    ]);

    const view = await loadDecisionsForWebsite({ websiteId: WEBSITE_ID, sessionToken: "token" });

    expect(view.current).toBe(false);
    expect(view.staleReason).toBe("crawl");
    expect(view.decisions).toHaveLength(1);
    expect(view.decisions[0].why.searchDemand).toEqual({ appearances: 153, visits: 26 });
  });
});
