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
  discoverRobotsUrl: () => "https://arngren.net/robots.txt",
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
  parseHtmlPage: (fetched: { requestedUrl: string; finalUrl: string }) => ({
    requestedUrl: fetched.requestedUrl,
    finalUrl: fetched.finalUrl,
    statusCode: 404,
    redirectChain: [],
    title: null,
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
    wordCount: 0,
  }),
}));

import { processCrawlRun } from "./process-run";

const recoveredRun = {
  id: "67e08897-dc98-4e59-aa79-c2819767f389",
  website_id: "website-1",
  status: "running",
  seed_url: "https://www.arngren.net/",
  max_pages: 10,
  pages_crawled: 9,
  pages_discovered: 2,
  error_message: null,
  started_at: "2026-09-10T21:49:09.162+00:00",
  completed_at: null,
  created_at: "2026-09-10T21:47:05.507085+00:00",
  websites: {
    id: "website-1",
    url: "https://www.arngren.net/",
    hostname: "arngren.net",
  },
};

const replayUrl = "http://www.arngren.net/eltrack-2";

describe("processCrawlRun stale-recovery replay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claimNextQueuedRunMock.mockResolvedValue(recoveredRun);
    saveSiteArtifactMock.mockResolvedValue(undefined);
    saveLinksMock.mockResolvedValue(undefined);
    markCrawlRunCompletedMock.mockResolvedValue(true);
    markCrawlRunFailedMock.mockResolvedValue(true);
    reconcileOrphanedPageProgressMock.mockResolvedValue(true);
    findPageByRequestedUrlMock.mockResolvedValue(null);
    ssrfSafeFetchMock.mockImplementation(async (url: string) => ({
      requestedUrl: url,
      finalUrl: url,
      statusCode: url.includes("robots.txt") ? 200 : 404,
      redirectChain: [],
      headers: {
        "content-type": url.includes("robots.txt") ? "text/plain" : "text/html",
      },
      body: url.includes("robots.txt") ? "User-agent: *\nDisallow:" : "<html></html>",
    }));
  });

  it("replays a persisted orphan page without fetch, unique violation, or run failure", async () => {
    let pagesCrawled = 9;

    getCrawlRunSummaryMock.mockImplementation(async () => ({
      id: recoveredRun.id,
      status: "running",
      hostname: "arngren.net",
      seedUrl: recoveredRun.seed_url,
      maxPages: 10,
      pagesCrawled,
      pagesDiscovered: 2,
      errorMessage: null,
      startedAt: recoveredRun.started_at,
      completedAt: null,
      createdAt: recoveredRun.created_at,
    }));

    reconcileOrphanedPageProgressMock.mockImplementation(async () => {
      pagesCrawled = 10;
      return true;
    });

    findPageByRequestedUrlMock.mockImplementation(async (_runId, url) => {
      if (url === replayUrl) {
        return {
          id: "8302143b-a6cd-4887-bf52-933ed4c15317",
          finalUrl: replayUrl,
        };
      }

      return null;
    });

    getNextQueueItemMock
      .mockResolvedValueOnce({
        id: "da32f36f-3c17-4e80-a4bb-50a1b4ca6d23",
        url: replayUrl,
        depth: 1,
        priority: 10,
        status: "pending",
      })
      .mockResolvedValue(null);

    const processedRunId = await processCrawlRun(recoveredRun.id);

    expect(processedRunId).toBe(recoveredRun.id);
    expect(ssrfSafeFetchMock).not.toHaveBeenCalledWith(replayUrl);
    expect(saveParsedPageMock).not.toHaveBeenCalled();
    expect(reconcileOrphanedPageProgressMock).toHaveBeenCalledWith(recoveredRun.id);
    expect(updateQueueItemMock).toHaveBeenCalledWith(
      "da32f36f-3c17-4e80-a4bb-50a1b4ca6d23",
      "done",
    );
    expect(markCrawlRunCompletedMock).toHaveBeenCalledWith(
      recoveredRun.id,
      "website-1",
      { expectedStartedAt: recoveredRun.started_at },
    );
    expect(markCrawlRunFailedMock).not.toHaveBeenCalled();
  });

  it("does not increment again when repeated replay sees counter already reconciled", async () => {
    claimNextQueuedRunMock.mockResolvedValue({
      ...recoveredRun,
      max_pages: 11,
    });

    getCrawlRunSummaryMock.mockResolvedValue({
      id: recoveredRun.id,
      status: "running",
      hostname: "arngren.net",
      seedUrl: recoveredRun.seed_url,
      maxPages: 11,
      pagesCrawled: 10,
      pagesDiscovered: 2,
      errorMessage: null,
      startedAt: recoveredRun.started_at,
      completedAt: null,
      createdAt: recoveredRun.created_at,
    });

    reconcileOrphanedPageProgressMock.mockResolvedValue(false);

    findPageByRequestedUrlMock.mockResolvedValue({
      id: "8302143b-a6cd-4887-bf52-933ed4c15317",
      finalUrl: replayUrl,
    });

    getNextQueueItemMock
      .mockResolvedValueOnce({
        id: "da32f36f-3c17-4e80-a4bb-50a1b4ca6d23",
        url: replayUrl,
        depth: 1,
        priority: 10,
        status: "pending",
      })
      .mockResolvedValue(null);

    await processCrawlRun(recoveredRun.id);

    expect(reconcileOrphanedPageProgressMock).toHaveBeenCalledTimes(1);
    expect(incrementCrawlProgressMock).not.toHaveBeenCalledWith(
      recoveredRun.id,
      1,
      0,
    );
    expect(markCrawlRunFailedMock).not.toHaveBeenCalled();
  });

  it("keeps distinct http and https requested URLs separate during resume checks", async () => {
    getCrawlRunSummaryMock.mockResolvedValue({
      id: recoveredRun.id,
      status: "running",
      hostname: "arngren.net",
      seedUrl: recoveredRun.seed_url,
      maxPages: 10,
      pagesCrawled: 0,
      pagesDiscovered: 1,
      errorMessage: null,
      startedAt: recoveredRun.started_at,
      completedAt: null,
      createdAt: recoveredRun.created_at,
    });

    findPageByRequestedUrlMock.mockImplementation(async (_runId, url) => {
      if (url === "http://www.arngren.net/moller.html") {
        return {
          id: "page-http",
          finalUrl: "http://www.arngren.net/moller.html",
        };
      }

      return null;
    });

    getNextQueueItemMock
      .mockResolvedValueOnce({
        id: "queue-https",
        url: "https://www.arngren.net/moller.html",
        depth: 1,
        priority: 10,
        status: "pending",
      })
      .mockResolvedValue(null);

    saveParsedPageMock.mockResolvedValue("page-https");

    await processCrawlRun(recoveredRun.id);

    expect(findPageByRequestedUrlMock).toHaveBeenCalledWith(
      recoveredRun.id,
      "https://www.arngren.net/moller.html",
    );
    expect(ssrfSafeFetchMock).toHaveBeenCalledWith("https://www.arngren.net/moller.html");
    expect(saveParsedPageMock).toHaveBeenCalled();
  });

  it("still fails normally on unrelated worker errors", async () => {
    getCrawlRunSummaryMock.mockResolvedValue({
      id: recoveredRun.id,
      status: "running",
      hostname: "arngren.net",
      seedUrl: recoveredRun.seed_url,
      maxPages: 10,
      pagesCrawled: 0,
      pagesDiscovered: 1,
      errorMessage: null,
      startedAt: recoveredRun.started_at,
      completedAt: null,
      createdAt: recoveredRun.created_at,
    });

    getNextQueueItemMock.mockRejectedValue(new Error("worker exploded"));

    await processCrawlRun(recoveredRun.id);

    expect(markCrawlRunFailedMock).toHaveBeenCalledWith(
      recoveredRun.id,
      "worker exploded",
      { expectedStartedAt: recoveredRun.started_at },
    );
  });
});
