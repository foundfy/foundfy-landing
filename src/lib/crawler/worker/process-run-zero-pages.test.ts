import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZERO_PAGE_CRAWL_FAILURE_MESSAGE } from "../crawl-usability";

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
const ssrfSafeFetchMock = vi.fn();

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
  ssrfSafeFetch: (...args: unknown[]) => ssrfSafeFetchMock(...args),
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
  }),
}));

import { SsrfValidationError } from "../security/ssrf-fetch";
import { processCrawlRun } from "./process-run";

const claimedRun = {
  id: "run-zero",
  website_id: "website-1",
  status: "running",
  seed_url: "https://example.com/",
  max_pages: 10,
  pages_crawled: 0,
  pages_discovered: 1,
  error_message: null,
  started_at: "2026-09-10T21:16:06.077+00:00",
  completed_at: null,
  created_at: "2026-09-10T21:16:05.457+00:00",
  websites: {
    id: "website-1",
    url: "https://example.com/",
    hostname: "example.com",
  },
};

const runningSummary = {
  id: "run-zero",
  status: "running" as const,
  hostname: "example.com",
  seedUrl: "https://example.com/",
  maxPages: 10,
  pagesCrawled: 0,
  pagesDiscovered: 1,
  errorMessage: null,
  startedAt: "2026-09-10T21:16:06.077+00:00",
  completedAt: null,
  createdAt: "2026-09-10T21:16:05.457+00:00",
};

describe("processCrawlRun zero-page integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findPageByRequestedUrlMock.mockResolvedValue(null);
    reconcileOrphanedPageProgressMock.mockResolvedValue(false);
    hasSitemapArtifactsMock.mockResolvedValue(false);
    listQueueUrlsMock.mockResolvedValue([]);
    claimNextQueuedRunMock.mockResolvedValue(claimedRun);
    saveSiteArtifactMock.mockResolvedValue(undefined);
    markCrawlRunFailedMock.mockResolvedValue(true);
    markCrawlRunCompletedMock.mockResolvedValue(true);
    ssrfSafeFetchMock.mockImplementation(async (url: string) => {
      if (url.includes("robots.txt")) {
        return {
          requestedUrl: url,
          finalUrl: url,
          statusCode: 200,
          redirectChain: [],
          headers: { "content-type": "text/plain" },
          body: "User-agent: *\nDisallow:",
        };
      }

      throw new SsrfValidationError("Request timed out.");
    });
  });

  it("marks the run failed when the seed times out and zero pages are stored", async () => {
    getCrawlRunSummaryMock.mockResolvedValue(runningSummary);
    getNextQueueItemMock
      .mockResolvedValueOnce({
        id: "queue-seed",
        url: "https://example.com/",
        depth: 0,
        priority: 100,
        status: "pending",
      })
      .mockResolvedValue(null);

    await processCrawlRun("run-zero");

    expect(markCrawlRunFailedMock).toHaveBeenCalledWith(
      "run-zero",
      ZERO_PAGE_CRAWL_FAILURE_MESSAGE,
      { expectedStartedAt: "2026-09-10T21:16:06.077+00:00" },
    );
    expect(markCrawlRunCompletedMock).not.toHaveBeenCalled();
  });

  it("completes normally when at least one page is stored", async () => {
    let pagesCrawled = 0;
    getCrawlRunSummaryMock.mockImplementation(async () => ({
      ...runningSummary,
      pagesCrawled,
    }));
    incrementCrawlProgressMock.mockImplementation(async () => {
      pagesCrawled = 1;
    });
    getNextQueueItemMock
      .mockResolvedValueOnce({
        id: "queue-seed",
        url: "https://example.com/",
        depth: 0,
        priority: 100,
        status: "pending",
      })
      .mockResolvedValue(null);
    ssrfSafeFetchMock.mockImplementation(async (url: string) => ({
      requestedUrl: url,
      finalUrl: url,
      statusCode: 200,
      redirectChain: [],
      headers: {
        "content-type": url.includes("robots.txt") ? "text/plain" : "text/html",
      },
      body: url.includes("robots.txt") ? "User-agent: *\nDisallow:" : "<html></html>",
    }));
    saveParsedPageMock.mockResolvedValue("page-1");

    await processCrawlRun("run-zero");

    expect(markCrawlRunCompletedMock).toHaveBeenCalledWith(
      "run-zero",
      "website-1",
      { expectedStartedAt: "2026-09-10T21:16:06.077+00:00" },
    );
    expect(markCrawlRunFailedMock).not.toHaveBeenCalled();
  });

  it("does not fail a recovered run when the worker lease no longer matches", async () => {
    getCrawlRunSummaryMock.mockResolvedValue(runningSummary);
    getNextQueueItemMock
      .mockResolvedValueOnce({
        id: "queue-seed",
        url: "https://example.com/",
        depth: 0,
        priority: 100,
        status: "pending",
      })
      .mockResolvedValue(null);
    markCrawlRunFailedMock.mockResolvedValue(false);

    await processCrawlRun("run-zero");

    expect(markCrawlRunFailedMock).toHaveBeenCalledWith(
      "run-zero",
      ZERO_PAGE_CRAWL_FAILURE_MESSAGE,
      { expectedStartedAt: "2026-09-10T21:16:06.077+00:00" },
    );
    expect(markCrawlRunCompletedMock).not.toHaveBeenCalled();
  });
});
