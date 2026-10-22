import { beforeEach, describe, expect, it, vi } from "vitest";

const requireObserveOwner = vi.fn();
const findResearchIdeaForWebsite = vi.fn();
const findResearchRunForWebsite = vi.fn();
const findLatestUsableCrawlRun = vi.fn();
const findLatestT0InspectRunForIdeaAndCrawl = vi.fn();
const loadInspectDecision = vi.fn();
const findInspectCrawl = vi.fn();
const listEvidenceForSync = vi.fn();
const claimTargetedObservation = vi.fn();
const finalizeTargetedObservation = vi.fn();
const findRunningTargetedObservation = vi.fn();
const findTargetedObservationForWebsite = vi.fn();
const listObserveQueueItems = vi.fn();
const listObservePages = vi.fn();
const listObserveLinks = vi.fn();
const loadSourceRobotsArtifact = vi.fn();
const fetchAndSaveTargetedPage = vi.fn();

vi.mock("@/lib/gsc/observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwner(...args),
}));
vi.mock("@/lib/research/repository", () => ({
  findResearchIdeaForWebsite: (...args: unknown[]) => findResearchIdeaForWebsite(...args),
  findResearchRunForWebsite: (...args: unknown[]) => findResearchRunForWebsite(...args),
}));
vi.mock("@/lib/websites/repository", () => ({
  findLatestUsableCrawlRun: (...args: unknown[]) => findLatestUsableCrawlRun(...args),
}));
vi.mock("@/lib/decisions/inspect-db", () => ({
  findLatestT0InspectRunForIdeaAndCrawl: (...args: unknown[]) =>
    findLatestT0InspectRunForIdeaAndCrawl(...args),
  loadInspectDecision: (...args: unknown[]) => loadInspectDecision(...args),
  findInspectCrawl: (...args: unknown[]) => findInspectCrawl(...args),
}));
vi.mock("@/lib/gsc/db-search", () => ({
  listEvidenceForSync: (...args: unknown[]) => listEvidenceForSync(...args),
}));
vi.mock("./db", () => ({
  claimTargetedObservation: (...args: unknown[]) => claimTargetedObservation(...args),
  finalizeTargetedObservation: (...args: unknown[]) => finalizeTargetedObservation(...args),
  findRunningTargetedObservation: (...args: unknown[]) => findRunningTargetedObservation(...args),
  findTargetedObservationForWebsite: (...args: unknown[]) =>
    findTargetedObservationForWebsite(...args),
  findAnalyzedObservationForIdeaCrawl: vi.fn(),
  listObserveQueueItems: (...args: unknown[]) => listObserveQueueItems(...args),
  listObservePages: (...args: unknown[]) => listObservePages(...args),
  listObserveLinks: (...args: unknown[]) => listObserveLinks(...args),
  loadSourceRobotsArtifact: (...args: unknown[]) => loadSourceRobotsArtifact(...args),
}));
vi.mock("./fetch-page", () => ({
  fetchAndSaveTargetedPage: (...args: unknown[]) => fetchAndSaveTargetedPage(...args),
  TargetedObserveFetchError: class TargetedObserveFetchError extends Error {
    reason: string;
    constructor(reason: string, message: string) {
      super(message);
      this.reason = reason;
    }
  },
}));

import { observeCandidateForOwner } from "./observe";

describe("observeCandidateForOwner claim HTTP gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireObserveOwner.mockResolvedValue({
      website: { hostname: "example.com" },
      owner: { id: "owner-1" },
    });
    findResearchIdeaForWebsite.mockResolvedValue({
      id: "idea-1",
      runId: "run-1",
      keyword: "pintar en seda",
      seedOffering: "seda",
      languageCode: "es",
    });
    findResearchRunForWebsite.mockResolvedValue({ id: "run-1", status: "completed" });
    findLatestUsableCrawlRun.mockResolvedValue({ id: "crawl-1", pagesCrawled: 3 });
    findLatestT0InspectRunForIdeaAndCrawl.mockResolvedValue({
      id: "t0-1",
      crawlRunId: "crawl-1",
      gscSearchSyncId: null,
    });
    loadInspectDecision.mockResolvedValue({
      inspectionState: "no_obvious_match_in_current_crawl",
    });
    findInspectCrawl.mockResolvedValue({ id: "crawl-1", pagesCrawled: 3, pagesDiscovered: 8 });
    listEvidenceForSync.mockResolvedValue([]);
    listObserveQueueItems.mockResolvedValue([
      {
        id: "queue-1",
        url: "https://example.com/es/pintar-en-seda",
        status: "pending",
        skipReason: null,
      },
    ]);
    listObservePages.mockResolvedValue([]);
    listObserveLinks.mockResolvedValue([]);
    loadSourceRobotsArtifact.mockResolvedValue({
      statusCode: 200,
      content: "User-agent: *\nAllow: /",
      parsed: { allow: ["/"], disallow: [], sitemaps: [] },
    });
    findRunningTargetedObservation.mockResolvedValue(null);
    findTargetedObservationForWebsite.mockResolvedValue({
      id: "obs-1",
      status: "analyzed",
      requestedUrl: "https://example.com/es/pintar-en-seda",
    });
  });

  it("fetches only when claim returns claimed", async () => {
    claimTargetedObservation.mockResolvedValue({
      status: "claimed",
      observationId: "obs-1",
      targetedCrawlRunId: "t-crawl-1",
      startedAt: "2026-10-20T00:00:00.000Z",
    });
    fetchAndSaveTargetedPage.mockResolvedValue("page-1");
    finalizeTargetedObservation.mockResolvedValue({ status: "analyzed" });

    const claimed = await observeCandidateForOwner({
      websiteId: "site-1",
      ideaId: "idea-1",
      sessionToken: "token",
      queueItemId: "queue-1",
    });
    expect(claimed.httpAttempted).toBe(true);
    expect(fetchAndSaveTargetedPage).toHaveBeenCalledTimes(1);
    expect(fetchAndSaveTargetedPage).toHaveBeenCalledWith(
      expect.objectContaining({
        startedAt: "2026-10-20T00:00:00.000Z",
      }),
    );

    for (const status of ["reused", "already_running", "stale_source"] as const) {
      fetchAndSaveTargetedPage.mockClear();
      claimTargetedObservation.mockResolvedValueOnce({
        status,
        observationId: "obs-1",
        targetedCrawlRunId: "t-crawl-1",
        startedAt: "2026-10-20T00:00:00.000Z",
        completedAt: "2026-10-20T00:00:01.000Z",
      });
      const result = await observeCandidateForOwner({
        websiteId: "site-1",
        ideaId: "idea-1",
        sessionToken: "token",
        queueItemId: "queue-1",
      });
      expect(result.httpAttempted).toBe(false);
      expect(fetchAndSaveTargetedPage).not.toHaveBeenCalled();
    }
  });

  it("finalizes a stale running observation before claiming", async () => {
    findRunningTargetedObservation.mockResolvedValue({
      id: "stale-obs",
      status: "running",
      startedAt: new Date(Date.now() - 121_000).toISOString(),
    });
    claimTargetedObservation.mockResolvedValue({
      status: "claimed",
      observationId: "obs-1",
      targetedCrawlRunId: "t-crawl-1",
      startedAt: "2026-10-20T00:00:00.000Z",
    });
    fetchAndSaveTargetedPage.mockResolvedValue("page-1");
    finalizeTargetedObservation.mockResolvedValue({ status: "analyzed" });

    await observeCandidateForOwner({
      websiteId: "site-1",
      ideaId: "idea-1",
      sessionToken: "token",
      queueItemId: "queue-1",
    });

    expect(finalizeTargetedObservation).toHaveBeenNthCalledWith(1, {
      observationId: "stale-obs",
      status: "fetch_failed",
      resultPageId: null,
      failureReason: "interrupted",
    });
    expect(claimTargetedObservation).toHaveBeenCalledTimes(1);
    expect(claimTargetedObservation.mock.calls[0]?.[0]).toMatchObject({
      sourceQueueId: "queue-1",
      selectionMode: "owner_selected",
    });
    expect(fetchAndSaveTargetedPage).toHaveBeenCalledTimes(1);
    expect(fetchAndSaveTargetedPage).toHaveBeenCalledWith(
      expect.objectContaining({
        startedAt: "2026-10-20T00:00:00.000Z",
      }),
    );
  });
});
