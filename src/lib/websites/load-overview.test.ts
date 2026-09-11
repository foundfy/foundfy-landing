import { beforeEach, describe, expect, it, vi } from "vitest";

const getWebsiteByIdMock = vi.fn();
const listCrawlRunsForWebsiteMock = vi.fn();
const findLatestUsableCrawlRunMock = vi.fn();
const findActiveCrawlRunForWebsiteMock = vi.fn();
const loadCompletedCrawlResultsMock = vi.fn();
const loadTrustworthyFindingsCountMock = vi.fn();

vi.mock("./repository", () => ({
  getWebsiteById: (...args: unknown[]) => getWebsiteByIdMock(...args),
  listCrawlRunsForWebsite: (...args: unknown[]) => listCrawlRunsForWebsiteMock(...args),
  findLatestUsableCrawlRun: (...args: unknown[]) => findLatestUsableCrawlRunMock(...args),
  findActiveCrawlRunForWebsite: (...args: unknown[]) =>
    findActiveCrawlRunForWebsiteMock(...args),
  isUsableWebsiteCrawlRun: (run: { status: string; pagesCrawled: number }) =>
    run.status === "completed" && run.pagesCrawled > 0,
}));

vi.mock("./findings-count", () => ({
  loadTrustworthyFindingsCount: (...args: unknown[]) =>
    loadTrustworthyFindingsCountMock(...args),
}));

vi.mock("@/lib/findings/load-completed-results", () => ({
  loadCompletedCrawlResults: (...args: unknown[]) => loadCompletedCrawlResultsMock(...args),
}));

import { loadWebsiteOverview } from "./load-overview";

const website = {
  id: "website-1",
  hostname: "ekoiq.com",
  displayUrl: "https://www.ekoiq.com/",
  firstSeenAt: "2026-09-10T00:00:00.000Z",
  lastCrawledAt: "2026-09-11T00:00:00.000Z",
};

describe("loadWebsiteOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWebsiteByIdMock.mockResolvedValue(website);
    findActiveCrawlRunForWebsiteMock.mockResolvedValue(null);
  });

  it("keeps latest usable scan when a newer crawl failed", async () => {
    const latestUsable = {
      id: "run-usable",
      websiteId: website.id,
      status: "completed" as const,
      seedUrl: "https://www.ekoiq.com/",
      pagesCrawled: 10,
      maxPages: 10,
      errorMessage: null,
      startedAt: "2026-09-10T15:00:00.000Z",
      completedAt: "2026-09-10T15:01:00.000Z",
      createdAt: "2026-09-10T14:59:59.000Z",
    };

    findLatestUsableCrawlRunMock.mockResolvedValue(latestUsable);
    listCrawlRunsForWebsiteMock.mockResolvedValue([
      {
        id: "run-failed",
        websiteId: website.id,
        status: "failed",
        seedUrl: "https://www.ekoiq.com/",
        pagesCrawled: 0,
        maxPages: 10,
        errorMessage: "timeout",
        startedAt: "2026-09-11T15:00:00.000Z",
        completedAt: "2026-09-11T15:01:00.000Z",
        createdAt: "2026-09-11T14:59:59.000Z",
      },
      latestUsable,
    ]);
    loadCompletedCrawlResultsMock.mockResolvedValue({
      findings: [
        { id: "finding-1", title: "Highlighted" },
        { id: "finding-2", title: "Other" },
      ],
      findingsSummary: {
        totalCount: 2,
        highlightedFindingIds: ["finding-1"],
        highlightGroups: [],
      },
      comparison: {
        previousCrawlRunId: "run-prev",
        previousCompletedAt: "2026-09-09T15:01:00.000Z",
        fixed: 1,
        stillPresent: 1,
        new: 0,
        unverified: 0,
        fixedFindings: [],
      },
      explanationEnrichmentStatus: "ready",
    });
    loadTrustworthyFindingsCountMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(22);

    const overview = await loadWebsiteOverview(website.id);

    expect(overview?.latestUsableScan?.crawlRunId).toBe("run-usable");
    expect(overview?.latestUsableScan?.comparison?.fixed).toBe(1);
    expect(overview?.highlightedFindings).toEqual([
      { id: "finding-1", title: "Highlighted" },
    ]);
    expect(overview?.scanHistory[0]?.findingsCount).toBeNull();
    expect(overview?.scanHistory[1]?.findingsCount).toBe(22);
  });

  it("returns null when the website does not exist", async () => {
    getWebsiteByIdMock.mockResolvedValue(null);

    await expect(loadWebsiteOverview("missing-website")).resolves.toBeNull();
  });
});
