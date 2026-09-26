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
  listQueueItems: async () => [],
  updateQueueItemPriority: async () => undefined,
  listPageHostVariantEvidence: async () => [],
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
    requestedUrl: "https://example.com/",
    finalUrl: "https://example.com/",
    statusCode: 200,
    redirectChain: [],
    title: "Home",
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
    navigationUrls: [],
  }),
}));

import { processCrawlRun } from "./process-run";

const WORKER_A_STARTED_AT = "2026-09-25T10:32:08.716Z";
const WORKER_B_STARTED_AT = "2026-09-25T10:34:08.716Z";

const claimedRun = {
  id: "run-ec315",
  website_id: "website-1",
  status: "running" as const,
  seed_url: "https://example.com/",
  max_pages: 10,
  pages_crawled: 0,
  pages_discovered: 1,
  error_message: null,
  started_at: WORKER_A_STARTED_AT,
  completed_at: null,
  created_at: "2026-09-25T10:32:00.000Z",
  websites: {
    id: "website-1",
    url: "https://example.com/",
    hostname: "example.com",
  },
};

function summary(startedAt: string, pagesCrawled = 0) {
  return {
    id: claimedRun.id,
    status: "running" as const,
    hostname: "example.com",
    seedUrl: claimedRun.seed_url,
    maxPages: 10,
    pagesCrawled,
    pagesDiscovered: 1,
    errorMessage: null,
    startedAt,
    completedAt: null,
    createdAt: claimedRun.created_at,
  };
}

describe("processCrawlRun claim lease", () => {
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
      crawlRunId: claimedRun.id,
      generatedCount: 0,
      observations: [],
    });
    incrementCrawlProgressMock.mockResolvedValue(true);
    saveParsedPageMock.mockResolvedValue("page-1");
    markCrawlRunCompletedMock.mockResolvedValue(true);
    claimNextQueuedRunMock.mockResolvedValue(claimedRun);
    getNextQueueItemMock
      .mockResolvedValueOnce({
        id: "queue-seed",
        url: "https://example.com/",
        depth: 0,
        priority: 100,
        status: "pending",
      })
      .mockResolvedValue(null);
  });

  it("exits quietly when Worker B has taken the claim", async () => {
    getCrawlRunSummaryMock.mockResolvedValue(summary(WORKER_B_STARTED_AT));

    const processed = await processCrawlRun(claimedRun.id);

    expect(processed).toBe(claimedRun.id);
    expect(incrementCrawlProgressMock).not.toHaveBeenCalled();
    expect(markCrawlRunCompletedMock).not.toHaveBeenCalled();
    expect(markCrawlRunFailedMock).not.toHaveBeenCalled();
  });

  it("does not increment progress after the lease is lost", async () => {
    let currentLease = WORKER_A_STARTED_AT;
    getCrawlRunSummaryMock.mockImplementation(async () => summary(currentLease));
    incrementCrawlProgressMock.mockImplementation(async () => {
      currentLease = WORKER_B_STARTED_AT;
      return false;
    });

    await processCrawlRun(claimedRun.id);

    expect(incrementCrawlProgressMock).toHaveBeenCalled();
    expect(markCrawlRunCompletedMock).not.toHaveBeenCalled();
    expect(markCrawlRunFailedMock).not.toHaveBeenCalled();
  });

  it("does not finalize a run after recovery transferred ownership", async () => {
    getCrawlRunSummaryMock.mockResolvedValue(summary(WORKER_B_STARTED_AT, 10));

    await processCrawlRun(claimedRun.id);

    expect(markCrawlRunCompletedMock).not.toHaveBeenCalled();
    expect(markCrawlRunFailedMock).not.toHaveBeenCalled();
  });
});
