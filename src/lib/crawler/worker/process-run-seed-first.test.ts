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
  discoverDefaultSitemapUrls: () => ["https://example.com/sitemap.xml"],
  isAllowedByRobots: (pathname: string) => pathname !== "/blocked",
  parseRobotsTxt: () => ({
    sitemaps: ["https://example.com/sitemap.xml"],
    disallow: ["/blocked"],
    allow: [],
  }),
}));

vi.mock("../discover/sitemap", () => ({
  isSitemapIndex: () => false,
  parseSitemapXml: () => ["https://example.com/sitemap-page"],
}));

vi.mock("../security/ssrf-fetch", () => ({
  SsrfValidationError: class SsrfValidationError extends Error {},
  ssrfSafeFetch: (...args: unknown[]) => ssrfSafeFetchMock(...args),
}));

vi.mock("../parse/page", () => ({
  parseHtmlPage: (fetched: { requestedUrl: string; finalUrl: string }) => ({
    requestedUrl: fetched.requestedUrl,
    finalUrl: fetched.finalUrl,
    statusCode: 200,
    redirectChain: [],
    title: "Page",
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

const claimedRun = {
  id: "run-seed",
  website_id: "website-1",
  status: "running",
  seed_url: "https://example.com/",
  max_pages: 2,
  pages_crawled: 0,
  pages_discovered: 1,
  error_message: null,
  started_at: "2026-09-11T12:00:00.000Z",
  completed_at: null,
  created_at: "2026-09-11T11:59:59.000Z",
  websites: {
    id: "website-1",
    url: "https://example.com/",
    hostname: "example.com",
  },
};

describe("processCrawlRun seed-first and discovery resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claimNextQueuedRunMock.mockResolvedValue(claimedRun);
    saveSiteArtifactMock.mockResolvedValue(undefined);
    saveLinksMock.mockResolvedValue(undefined);
    saveParsedPageMock.mockResolvedValue("page-1");
    markCrawlRunCompletedMock.mockResolvedValue(true);
    findPageByRequestedUrlMock.mockResolvedValue(null);
    reconcileOrphanedPageProgressMock.mockResolvedValue(false);
    hasSitemapArtifactsMock.mockResolvedValue(false);
    listQueueUrlsMock.mockResolvedValue([]);
    ssrfSafeFetchMock.mockImplementation(async (url: string) => ({
      requestedUrl: url,
      finalUrl: url,
      statusCode: 200,
      redirectChain: [],
      headers: {
        "content-type": url.includes("robots.txt")
          ? "text/plain"
          : url.includes("sitemap")
            ? "application/xml"
            : "text/html",
      },
      body: url.includes("robots.txt")
        ? "User-agent: *\nDisallow: /blocked\nSitemap: https://example.com/sitemap.xml"
        : url.includes("sitemap")
          ? "<urlset><url><loc>https://example.com/sitemap-page</loc></url></urlset>"
          : "<html></html>",
    }));
  });

  it("persists the seed page before sitemap discovery artifacts are saved", async () => {
    let pagesCrawled = 0;
    getCrawlRunSummaryMock.mockImplementation(async () => ({
      id: claimedRun.id,
      status: "running",
      hostname: "example.com",
      seedUrl: claimedRun.seed_url,
      maxPages: 2,
      pagesCrawled,
      pagesDiscovered: 1,
      errorMessage: null,
      startedAt: claimedRun.started_at,
      completedAt: null,
      createdAt: claimedRun.created_at,
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
      .mockResolvedValueOnce({
        id: "queue-sitemap-page",
        url: "https://example.com/sitemap-page",
        depth: 0,
        priority: 50,
        status: "pending",
      })
      .mockResolvedValue(null);

    await processCrawlRun("run-seed");

    const seedHtmlFetchIndex = ssrfSafeFetchMock.mock.calls.findIndex(
      (call) => call[0] === "https://example.com/",
    );
    const sitemapFetchIndex = ssrfSafeFetchMock.mock.calls.findIndex(
      (call) => typeof call[0] === "string" && call[0].includes("sitemap"),
    );

    expect(seedHtmlFetchIndex).toBeGreaterThan(-1);
    expect(sitemapFetchIndex).toBeGreaterThan(-1);
    expect(seedHtmlFetchIndex).toBeLessThan(sitemapFetchIndex);
    expect(saveParsedPageMock).toHaveBeenCalled();
  });

  it("blocks a robots-disallowed seed without persisting it", async () => {
    claimNextQueuedRunMock.mockResolvedValue({
      ...claimedRun,
      seed_url: "https://example.com/blocked",
    });

    getCrawlRunSummaryMock.mockResolvedValue({
      id: claimedRun.id,
      status: "running",
      hostname: "example.com",
      seedUrl: "https://example.com/blocked",
      maxPages: 2,
      pagesCrawled: 0,
      pagesDiscovered: 1,
      errorMessage: null,
      startedAt: claimedRun.started_at,
      completedAt: null,
      createdAt: claimedRun.created_at,
    });

    getNextQueueItemMock
      .mockResolvedValueOnce({
        id: "queue-seed-blocked",
        url: "https://example.com/blocked",
        depth: 0,
        priority: 100,
        status: "pending",
      })
      .mockResolvedValue(null);

    await processCrawlRun("run-seed");

    expect(updateQueueItemMock).toHaveBeenCalledWith(
      "queue-seed-blocked",
      "skipped",
      "robots_disallow",
    );
    expect(saveParsedPageMock).not.toHaveBeenCalled();
    expect(markCrawlRunFailedMock).toHaveBeenCalledWith(
      "run-seed",
      "We couldn't successfully crawl any pages from this website.",
      { expectedStartedAt: claimedRun.started_at },
    );
  });

  it("skips sitemap discovery when artifacts already exist on stale recovery", async () => {
    hasSitemapArtifactsMock.mockResolvedValue(true);
    listQueueUrlsMock.mockResolvedValue([
      "https://example.com/",
      "https://example.com/sitemap-page",
    ]);

    let pagesCrawled = 1;
    getCrawlRunSummaryMock.mockImplementation(async () => ({
      id: claimedRun.id,
      status: "running",
      hostname: "example.com",
      seedUrl: claimedRun.seed_url,
      maxPages: 2,
      pagesCrawled,
      pagesDiscovered: 2,
      errorMessage: null,
      startedAt: claimedRun.started_at,
      completedAt: null,
      createdAt: claimedRun.created_at,
    }));
    incrementCrawlProgressMock.mockImplementation(async () => {
      pagesCrawled = 2;
    });

    getNextQueueItemMock
      .mockResolvedValueOnce({
        id: "queue-seed",
        url: "https://example.com/",
        depth: 0,
        priority: 100,
        status: "pending",
      })
      .mockResolvedValueOnce({
        id: "queue-sitemap-page",
        url: "https://example.com/sitemap-page",
        depth: 0,
        priority: 50,
        status: "pending",
      })
      .mockResolvedValue(null);

    await processCrawlRun("run-seed");

    expect(hasSitemapArtifactsMock).toHaveBeenCalledWith("run-seed");
    expect(listQueueUrlsMock).toHaveBeenCalledWith("run-seed");
    expect(
      saveSiteArtifactMock.mock.calls.some(
        (call) => call[0]?.artifactType === "sitemap_xml",
      ),
    ).toBe(false);
    expect(ssrfSafeFetchMock).not.toHaveBeenCalledWith("https://example.com/sitemap.xml");
  });
});
