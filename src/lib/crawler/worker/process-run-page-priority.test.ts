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
const generateObservationsForCrawlRunMock = vi.fn();
const parseSitemapXmlMock = vi.fn();

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
  parseSitemapXml: (...args: unknown[]) => parseSitemapXmlMock(...args),
}));

vi.mock("../security/ssrf-fetch", () => ({
  SsrfValidationError: class SsrfValidationError extends Error {},
  ssrfSafeFetch: (...args: unknown[]) => ssrfSafeFetchMock(...args),
}));

import { processCrawlRun } from "./process-run";

const claimedRun = {
  id: "run-priority",
  website_id: "website-1",
  status: "running",
  seed_url: "https://example.com/",
  max_pages: 10,
  pages_crawled: 0,
  pages_discovered: 1,
  error_message: null,
  started_at: "2026-09-12T12:00:00.000Z",
  completed_at: null,
  created_at: "2026-09-12T11:59:59.000Z",
  websites: {
    id: "website-1",
    url: "https://example.com/",
    hostname: "example.com",
  },
};

describe("processCrawlRun page priority", () => {
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
    parseSitemapXmlMock.mockReturnValue([
      "https://example.com/login",
      "https://example.com/cart",
      "https://example.com/blog/2020/old-article",
      "https://example.com/hakkimizda",
      "https://example.com/dergi",
    ]);
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
          : `<!doctype html>
            <html lang="tr">
              <body>
                <nav>
                  <a href="/hakkimizda">Hakkımızda</a>
                  <a href="/login">Giriş</a>
                  <a href="/cart">Sepet</a>
                </nav>
                <main><h1>Home</h1><p>Magazine homepage</p></main>
              </body>
            </html>`,
    }));
  });

  it("enqueues identity sitemap/nav URLs above login and cart", async () => {
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

    await processCrawlRun("run-priority");

    const enqueued = enqueueUrlMock.mock.calls.map(
      (call) => call[0] as { url: string; priority: number },
    );
    const priorityByUrl = new Map(enqueued.map((item) => [item.url, item.priority]));

    expect(priorityByUrl.get("https://example.com/")).toBe(100);
    expect(priorityByUrl.get("https://example.com/hakkimizda") ?? 0).toBeGreaterThan(
      priorityByUrl.get("https://example.com/login") ?? 0,
    );
    expect(priorityByUrl.get("https://example.com/dergi") ?? 0).toBeGreaterThan(
      priorityByUrl.get("https://example.com/cart") ?? 0,
    );
    expect(priorityByUrl.get("https://example.com/hakkimizda") ?? 0).toBeGreaterThan(
      priorityByUrl.get("https://example.com/blog/2020/old-article") ?? 0,
    );
  });
});
