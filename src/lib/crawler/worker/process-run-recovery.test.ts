import { beforeEach, describe, expect, it, vi } from "vitest";

const claimNextQueuedRunMock = vi.fn();
const getCrawlRunSummaryMock = vi.fn();
const getNextQueueItemMock = vi.fn();
const updateQueueItemMock = vi.fn();
const incrementCrawlProgressMock = vi.fn();
const saveParsedPageMock = vi.fn();
const saveLinksMock = vi.fn();
const saveSiteArtifactMock = vi.fn();
const markCrawlRunCompletedMock = vi.fn();
const markCrawlRunFailedMock = vi.fn();
const enqueueUrlMock = vi.fn();
const findPageByRequestedUrlMock = vi.fn();
const reconcileOrphanedPageProgressMock = vi.fn();
const hasSitemapArtifactsMock = vi.fn();
const listQueueUrlsMock = vi.fn();
const generateObservationsForCrawlRunMock = vi.fn();

vi.mock("@/lib/observations/db/repository", () => ({
  generateObservationsForCrawlRun: (...args: unknown[]) =>
    generateObservationsForCrawlRunMock(...args),
}));

vi.mock("../db/repository", () => ({
  claimNextQueuedRun: (...args: unknown[]) => claimNextQueuedRunMock(...args),
  getCrawlRunSummary: (...args: unknown[]) => getCrawlRunSummaryMock(...args),
  getNextQueueItem: (...args: unknown[]) => getNextQueueItemMock(...args),
  updateQueueItem: (...args: unknown[]) => updateQueueItemMock(...args),
  incrementCrawlProgress: (...args: unknown[]) => incrementCrawlProgressMock(...args),
  saveParsedPage: (...args: unknown[]) => saveParsedPageMock(...args),
  saveLinks: (...args: unknown[]) => saveLinksMock(...args),
  saveSiteArtifact: (...args: unknown[]) => saveSiteArtifactMock(...args),
  markCrawlRunCompleted: (...args: unknown[]) => markCrawlRunCompletedMock(...args),
  markCrawlRunFailed: (...args: unknown[]) => markCrawlRunFailedMock(...args),
  enqueueUrl: (...args: unknown[]) => enqueueUrlMock(...args),
  findPageByRequestedUrl: (...args: unknown[]) => findPageByRequestedUrlMock(...args),
  reconcileOrphanedPageProgress: (...args: unknown[]) =>
    reconcileOrphanedPageProgressMock(...args),
  hasSitemapArtifacts: (...args: unknown[]) => hasSitemapArtifactsMock(...args),
  listQueueUrls: (...args: unknown[]) => listQueueUrlsMock(...args),
  toActiveCrawlRun: (row: {
    id: string;
    website_id: string;
    seed_url: string;
    max_pages: number;
    websites: { id: string; url: string; hostname: string };
  }) => ({
    id: row.id,
    websiteId: row.websites.id,
    websiteUrl: row.websites.url,
    hostname: row.websites.hostname,
    seedUrl: row.seed_url,
    maxPages: row.max_pages,
  }),
}));

vi.mock("../discover/robots", () => ({
  discoverRobotsUrl: () => "https://example.com/robots.txt",
  discoverDefaultSitemapUrls: () => [],
  isAllowedByRobots: () => true,
  parseRobotsTxt: () => ({ sitemaps: [], disallow: [], allow: [] }),
}));

vi.mock("../discover/sitemap", () => ({
  isSitemapIndex: () => false,
  parseSitemapXml: () => [],
}));

vi.mock("../security/ssrf-fetch", () => ({
  SsrfValidationError: class SsrfValidationError extends Error {},
  ssrfSafeFetch: vi.fn(async (url: string) => ({
    requestedUrl: url,
    finalUrl: url,
    statusCode: 200,
    redirectChain: [],
    headers: {
      "content-type": url.includes("robots.txt") ? "text/plain" : "text/html",
    },
    body: url.includes("robots.txt") ? "User-agent: *\nDisallow:" : "<html></html>",
  })),
}));

vi.mock("../parse/page", () => ({
  parseHtmlPage: () => ({
    requestedUrl: "https://example.com/page-2",
    finalUrl: "https://example.com/page-2",
    statusCode: 200,
    redirectChain: [],
    title: "Page 2",
    metaDescription: null,
    canonical: null,
    robotsMeta: null,
    xRobotsTag: null,
    h1: [],
    h2: [],
    htmlLang: null,
    internalLinks: [],
    externalLinks: [],
    imageCount: 0,
    missingAltCount: 0,
    jsonLdTypes: [],
    wordCount: 10,
  }),
}));

import { processCrawlRun } from "./process-run";

describe("processCrawlRun after stale recovery", () => {
  beforeEach(() => {
    claimNextQueuedRunMock.mockReset();
    getCrawlRunSummaryMock.mockReset();
    getNextQueueItemMock.mockReset();
    updateQueueItemMock.mockReset();
    incrementCrawlProgressMock.mockReset();
    saveParsedPageMock.mockReset();
    saveLinksMock.mockReset();
    saveSiteArtifactMock.mockReset();
    markCrawlRunCompletedMock.mockReset();
    markCrawlRunFailedMock.mockReset();
    enqueueUrlMock.mockReset();
    findPageByRequestedUrlMock.mockReset();
    findPageByRequestedUrlMock.mockResolvedValue(null);
    reconcileOrphanedPageProgressMock.mockReset();
    reconcileOrphanedPageProgressMock.mockResolvedValue(false);
    hasSitemapArtifactsMock.mockReset();
    hasSitemapArtifactsMock.mockResolvedValue(false);
    listQueueUrlsMock.mockReset();
    listQueueUrlsMock.mockResolvedValue([]);
    generateObservationsForCrawlRunMock.mockReset();
    generateObservationsForCrawlRunMock.mockResolvedValue({
      crawlRunId: "run-1",
      generatedCount: 0,
      observations: [],
    });
  });

  it("continues a partially crawled run and reaches completed", async () => {
    claimNextQueuedRunMock.mockResolvedValue({
      id: "run-1",
      website_id: "website-1",
      status: "running",
      seed_url: "https://example.com/",
      max_pages: 2,
      pages_crawled: 1,
      pages_discovered: 3,
      error_message: null,
      started_at: "2026-09-10T15:05:01.000Z",
      completed_at: null,
      created_at: "2026-09-10T14:59:59.000Z",
      websites: {
        id: "website-1",
        url: "https://example.com/",
        hostname: "example.com",
      },
    });

    getCrawlRunSummaryMock.mockResolvedValue({
      id: "run-1",
      status: "running",
      hostname: "example.com",
      seedUrl: "https://example.com/",
      maxPages: 2,
      pagesCrawled: 1,
      pagesDiscovered: 1,
      errorMessage: null,
      startedAt: "2026-09-10T15:05:01.000Z",
      completedAt: null,
      createdAt: "2026-09-10T14:59:59.000Z",
    });

    getNextQueueItemMock
      .mockResolvedValueOnce({
        id: "queue-2",
        url: "https://example.com/page-2",
        depth: 1,
        priority: 10,
        status: "pending",
      })
      .mockResolvedValue(null);

    saveParsedPageMock.mockResolvedValue("page-2");
    markCrawlRunCompletedMock.mockResolvedValue(true);

    const processedRunId = await processCrawlRun("run-1");

    expect(processedRunId).toBe("run-1");
    expect(claimNextQueuedRunMock).toHaveBeenCalledWith("run-1");
    expect(markCrawlRunCompletedMock).toHaveBeenCalledWith(
      "run-1",
      "website-1",
      { expectedStartedAt: "2026-09-10T15:05:01.000Z" },
    );
  });

  it("does not fail a recovered run when the stale worker lease no longer matches", async () => {
    claimNextQueuedRunMock.mockResolvedValue({
      id: "run-1",
      website_id: "website-1",
      status: "running",
      seed_url: "https://example.com/",
      max_pages: 1,
      pages_crawled: 0,
      pages_discovered: 1,
      error_message: null,
      started_at: "2026-09-10T15:00:00.000Z",
      completed_at: null,
      created_at: "2026-09-10T14:59:59.000Z",
      websites: {
        id: "website-1",
        url: "https://example.com/",
        hostname: "example.com",
      },
    });

    getCrawlRunSummaryMock.mockResolvedValue({
      id: "run-1",
      status: "running",
      hostname: "example.com",
      seedUrl: "https://example.com/",
      maxPages: 1,
      pagesCrawled: 0,
      pagesDiscovered: 1,
      errorMessage: null,
      startedAt: "2026-09-10T15:00:00.000Z",
      completedAt: null,
      createdAt: "2026-09-10T14:59:59.000Z",
    });

    getNextQueueItemMock.mockRejectedValue(new Error("worker exploded"));
    markCrawlRunFailedMock.mockResolvedValue(false);

    await processCrawlRun("run-1");

    expect(markCrawlRunFailedMock).toHaveBeenCalledWith(
      "run-1",
      "worker exploded",
      { expectedStartedAt: "2026-09-10T15:00:00.000Z" },
    );
  });
});
