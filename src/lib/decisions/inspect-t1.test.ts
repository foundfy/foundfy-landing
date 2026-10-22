import { beforeEach, describe, expect, it, vi } from "vitest";

const requireObserveOwner = vi.fn();
const findResearchIdeaForWebsite = vi.fn();
const findResearchRunForWebsite = vi.fn();
const findLatestUsableCrawlRun = vi.fn();
const findTargetedObservationForWebsite = vi.fn();
const findInspectRunById = vi.fn();
const loadInspectDecision = vi.fn();
const findInspectCrawl = vi.fn();
const listInspectPagesForCrawl = vi.fn();
const listInspectPageById = vi.fn();
const persistResearchInspectDecisionWithObservation = vi.fn();

vi.mock("@/lib/gsc/observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwner(...args),
}));
vi.mock("@/lib/research/repository", () => ({
  findResearchIdeaForWebsite: (...args: unknown[]) => findResearchIdeaForWebsite(...args),
  findResearchRunForWebsite: (...args: unknown[]) => findResearchRunForWebsite(...args),
  findLatestReadableCompletedRunForFingerprint: vi.fn(),
}));
vi.mock("@/lib/websites/repository", () => ({
  findLatestUsableCrawlRun: (...args: unknown[]) => findLatestUsableCrawlRun(...args),
}));
vi.mock("@/lib/observe/db", () => ({
  findTargetedObservationForWebsite: (...args: unknown[]) =>
    findTargetedObservationForWebsite(...args),
}));
vi.mock("./inspect-db", () => ({
  findInspectRunById: (...args: unknown[]) => findInspectRunById(...args),
  loadInspectDecision: (...args: unknown[]) => loadInspectDecision(...args),
  findInspectCrawl: (...args: unknown[]) => findInspectCrawl(...args),
  listInspectPagesForCrawl: (...args: unknown[]) => listInspectPagesForCrawl(...args),
  listInspectPageById: (...args: unknown[]) => listInspectPageById(...args),
  persistResearchInspectDecision: vi.fn(),
  findCompletedInspectRun: vi.fn(),
  listCompletedInspectRunsForIdeas: vi.fn(),
}));
vi.mock("./inspect-t1-db", () => ({
  persistResearchInspectDecisionWithObservation: (...args: unknown[]) =>
    persistResearchInspectDecisionWithObservation(...args),
}));

import { inspectRelatedDemandAfterObservationForOwner } from "./inspect";

describe("T1 inspectRelatedDemandAfterObservationForOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireObserveOwner.mockResolvedValue({ website: { hostname: "example.com" } });
    findResearchIdeaForWebsite.mockResolvedValue({
      id: "idea-1",
      runId: "run-1",
      keyword: "pintar en seda",
      compactKey: "pintarensed",
      languageCode: "es",
      seedOffering: "seda",
      estimatedMonthlySearches: 10,
    });
    findResearchRunForWebsite.mockResolvedValue({
      id: "run-1",
      status: "completed",
      countryKey: "es",
      countryName: "Spain",
      languageCodes: ["es"],
      offeringSeeds: ["seda"],
    });
    findLatestUsableCrawlRun.mockResolvedValue({ id: "crawl-1", pagesCrawled: 3 });
    findTargetedObservationForWebsite.mockResolvedValue({
      id: "obs-1",
      status: "analyzed",
      resultPageId: "page-t1",
      sourceResearchIdeaId: "idea-1",
      sourceInspectRunId: "t0-1",
      sourceCrawlRunId: "crawl-1",
    });
    findInspectRunById.mockResolvedValue({
      id: "t0-1",
      researchIdeaId: "idea-1",
      crawlRunId: "crawl-1",
      targetedObservationId: null,
      siteModelId: "model-1",
      gscSearchSyncId: "gsc-original",
      gscTruncated: false,
    });
    loadInspectDecision.mockResolvedValue({
      inspectionState: "no_obvious_match_in_current_crawl",
      evidenceRefs: [{ kind: "research_idea", snapshot: { gscCopy: "gsc copy" } }],
      state: "no_obvious_match_after_targeted_observation",
      resultCopy: "after",
      gscCopy: "gsc copy",
      crawlBounded: false,
      crawlBoundedCopy: null,
      nextStepCopy: "next",
      decisionId: "d1",
      runId: "t1-1",
    });
    findInspectCrawl.mockResolvedValue({ id: "crawl-1", pagesCrawled: 3, pagesDiscovered: 8 });
    listInspectPagesForCrawl.mockResolvedValue([
      {
        id: "base-1",
        requestedUrl: "https://example.com/es",
        finalUrl: "https://example.com/es",
        title: "home",
        h1: [],
        metaDescription: null,
        excerpt: null,
        htmlLang: "es",
        urlLocale: "es",
        canonical: null,
      },
    ]);
    listInspectPageById.mockResolvedValue({
      id: "page-t1",
      requestedUrl: "https://example.com/es/pintar-en-seda",
      finalUrl: "https://example.com/es/pintar-en-seda",
      title: "Pintar",
      h1: [],
      metaDescription: null,
      excerpt: null,
      htmlLang: "es",
      urlLocale: "es",
      canonical: null,
    });
    persistResearchInspectDecisionWithObservation.mockResolvedValue({
      reused: false,
      runId: "t1-1",
      decisionId: "d1",
    });
  });

  it("uses the final latest-usable check immediately before T1 persist", async () => {
    await inspectRelatedDemandAfterObservationForOwner({
      websiteId: "site-1",
      ideaId: "idea-1",
      sessionToken: "token",
      targetedObservationId: "obs-1",
    });

    expect(findLatestUsableCrawlRun).toHaveBeenCalledWith("site-1");
    expect(persistResearchInspectDecisionWithObservation).toHaveBeenCalledTimes(1);
    const persisted = persistResearchInspectDecisionWithObservation.mock.calls[0]?.[0];
    expect(persisted).toMatchObject({
      crawlRunId: "crawl-1",
      gscSearchSyncId: "gsc-original",
      targetedObservationId: "obs-1",
    });
    expect(persisted.inspectionState).not.toBe("no_obvious_match_in_current_crawl");
    expect([
      "clear_existing_page_evidence",
      "ambiguous",
      "no_obvious_match_after_targeted_observation",
    ]).toContain(persisted.inspectionState);
  });

  it("blocks T1 writes when a newer site_sample is the latest usable crawl", async () => {
    findLatestUsableCrawlRun.mockResolvedValue({ id: "crawl-2", pagesCrawled: 4 });
    await expect(
      inspectRelatedDemandAfterObservationForOwner({
        websiteId: "site-1",
        ideaId: "idea-1",
        sessionToken: "token",
        targetedObservationId: "obs-1",
      }),
    ).rejects.toMatchObject({ code: "t0_stale" });
    expect(persistResearchInspectDecisionWithObservation).not.toHaveBeenCalled();
  });

  it("rejects idea mismatch and still uses source inspect GSC", async () => {
    findTargetedObservationForWebsite.mockResolvedValue({
      id: "obs-1",
      status: "analyzed",
      resultPageId: "page-t1",
      sourceResearchIdeaId: "other-idea",
      sourceInspectRunId: "t0-1",
      sourceCrawlRunId: "crawl-1",
    });
    await expect(
      inspectRelatedDemandAfterObservationForOwner({
        websiteId: "site-1",
        ideaId: "idea-1",
        sessionToken: "token",
        targetedObservationId: "obs-1",
      }),
    ).rejects.toMatchObject({ code: "idea_mismatch" });
    expect(persistResearchInspectDecisionWithObservation).not.toHaveBeenCalled();
  });
});
