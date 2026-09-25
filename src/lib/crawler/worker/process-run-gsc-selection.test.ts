import { beforeEach, describe, expect, it, vi } from "vitest";
import { GSC_QUEUE_PRIORITY, UNSELECTED_QUEUE_PRIORITY } from "../select/gsc-informed-selection";

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
const listQueueItemsMock = vi.fn();
const updateQueueItemPriorityMock = vi.fn();
const ssrfSafeFetchMock = vi.fn();
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
  listQueueItems: (...args: unknown[]) => listQueueItemsMock(...args),
  updateQueueItemPriority: (...args: unknown[]) => updateQueueItemPriorityMock(...args),
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
  discoverDefaultSitemapUrls: () => ["https://example.com/sitemap.xml"],
  isAllowedByRobots: () => true,
  parseRobotsTxt: () => ({
    sitemaps: ["https://example.com/sitemap.xml"],
    disallow: [],
    allow: [],
  }),
}));

vi.mock("../discover/sitemap", () => ({
  isSitemapIndex: () => false,
  parseSitemapXml: () => ["https://example.com/about", "https://example.com/old-post"],
}));

vi.mock("../security/ssrf-fetch", () => ({
  SsrfValidationError: class SsrfValidationError extends Error {},
  ssrfSafeFetch: (...args: unknown[]) => ssrfSafeFetchMock(...args),
}));

import { processCrawlRun } from "./process-run";

const claimedRun = {
  id: "run-gsc",
  website_id: "website-1",
  status: "running",
  seed_url: "https://example.com/",
  max_pages: 10,
  pages_crawled: 0,
  pages_discovered: 1,
  error_message: null,
  started_at: "2026-09-24T12:00:00.000Z",
  completed_at: null,
  created_at: "2026-09-24T11:59:59.000Z",
  websites: {
    id: "website-1",
    url: "https://example.com/",
    hostname: "example.com",
  },
};

describe("processCrawlRun GSC-informed selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claimNextQueuedRunMock.mockResolvedValue(claimedRun);
    saveSiteArtifactMock.mockResolvedValue(undefined);
    saveLinksMock.mockResolvedValue(undefined);
    saveParsedPageMock.mockResolvedValue("page-1");
    markCrawlRunCompletedMock.mockResolvedValue(true);
    generateObservationsForCrawlRunMock.mockResolvedValue({
      crawlRunId: claimedRun.id,
      generatedCount: 0,
      observations: [],
    });
    findPageByRequestedUrlMock.mockResolvedValue(null);
    reconcileOrphanedPageProgressMock.mockResolvedValue(false);
    hasSitemapArtifactsMock.mockResolvedValue(false);
    listQueueUrlsMock.mockResolvedValue([]);
    updateQueueItemPriorityMock.mockResolvedValue(undefined);
    listQueueItemsMock.mockResolvedValue([]);
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
        ? "User-agent: *\nSitemap: https://example.com/sitemap.xml"
        : url.includes("sitemap")
          ? "<urlset></urlset>"
          : `<!doctype html><html><body><nav><a href="/about">About</a></nav><main><h1>Home</h1></main></body></html>`,
    }));
  });

  it("does not rewrite queue priorities when no GSC candidates were injected", async () => {
    let pagesCrawled = 0;
    getCrawlRunSummaryMock.mockImplementation(async () => ({
      id: claimedRun.id,
      status: "running",
      hostname: "example.com",
      seedUrl: claimedRun.seed_url,
      maxPages: 10,
      pagesCrawled,
      pagesDiscovered: 1,
      errorMessage: null,
      startedAt: claimedRun.started_at,
      completedAt: null,
      createdAt: claimedRun.created_at,
    }));
    incrementCrawlProgressMock.mockImplementation(async (_id: string, crawledDelta: number) => {
      pagesCrawled += crawledDelta;
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

    await processCrawlRun("run-gsc");

    expect(updateQueueItemPriorityMock).not.toHaveBeenCalled();
    expect(pagesCrawled).toBe(1);
  });

  it("reprioritizes the bounded queue around injected GSC URLs", async () => {
    const queueItems = [
      {
        id: "queue-seed",
        url: "https://example.com/",
        depth: 0,
        priority: 100,
        status: "done",
        createdAt: "2026-09-24T12:00:00.000Z",
      },
      {
        id: "queue-gsc",
        url: "https://example.com/hidden-product",
        depth: 0,
        priority: GSC_QUEUE_PRIORITY,
        status: "pending",
        createdAt: "2026-09-24T12:00:01.000Z",
      },
      {
        id: "queue-old",
        url: "https://example.com/old-post",
        depth: 0,
        priority: 53,
        status: "pending",
        createdAt: "2026-09-24T12:00:02.000Z",
      },
      {
        id: "queue-about",
        url: "https://example.com/about",
        depth: 0,
        priority: 99,
        status: "pending",
        createdAt: "2026-09-24T12:00:03.000Z",
      },
      ...Array.from({ length: 12 }, (_, index) => ({
        id: `queue-blog-${index}`,
        url: `https://example.com/blog/2020/old-article-${index}`,
        depth: 0,
        priority: 48,
        status: "pending",
        createdAt: `2026-09-24T12:00:1${index}.000Z`,
      })),
      {
        id: "queue-zzz",
        url: "https://example.com/blog/2020/zzz-unselected",
        depth: 0,
        priority: 48,
        status: "pending",
        createdAt: "2026-09-24T12:00:29.000Z",
      },
    ];
    listQueueItemsMock.mockResolvedValue(queueItems);

    let pagesCrawled = 1;
    getCrawlRunSummaryMock.mockImplementation(async () => ({
      id: claimedRun.id,
      status: "running",
      hostname: "example.com",
      seedUrl: claimedRun.seed_url,
      maxPages: 10,
      pagesCrawled,
      pagesDiscovered: 4,
      errorMessage: null,
      startedAt: claimedRun.started_at,
      completedAt: null,
      createdAt: claimedRun.created_at,
    }));
    incrementCrawlProgressMock.mockImplementation(async (_id: string, crawledDelta: number) => {
      pagesCrawled += crawledDelta;
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

    await processCrawlRun("run-gsc");

    expect(updateQueueItemPriorityMock).toHaveBeenCalled();
    const priorityById = new Map(
      updateQueueItemPriorityMock.mock.calls.map((call) => [call[0], call[1]]),
    );
    expect(priorityById.get("queue-zzz")).toBe(UNSELECTED_QUEUE_PRIORITY);
    expect(priorityById.get("queue-gsc")).not.toBe(UNSELECTED_QUEUE_PRIORITY);
  });
});
