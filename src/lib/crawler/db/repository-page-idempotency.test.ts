import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countPagesForCrawlRun,
  findPageByRequestedUrl,
  isPageRequestedUrlUniqueConflict,
  reconcileOrphanedPageProgress,
  saveParsedPage,
} from "./repository";

const parsedPage = {
  requestedUrl: "http://www.example.com/page",
  finalUrl: "http://www.example.com/page",
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
};

const insertSingleMock = vi.fn();
const pageLookupMaybeSingleMock = vi.fn();
const pageCountHeadMock = vi.fn();
const crawlRunSummaryMaybeSingleMock = vi.fn();
const crawlRunProgressUpdateMock = vi.fn();
const crawlRunProgressEqMock = vi.fn();

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "pages") {
        return {
          insert: () => ({
            select: () => ({
              single: insertSingleMock,
            }),
          }),
          select: (columns: string, options?: { count?: string; head?: boolean }) => {
            if (options?.head) {
              return {
                eq: () => pageCountHeadMock(),
              };
            }

            return {
              eq: () => ({
                eq: () => ({
                  maybeSingle: pageLookupMaybeSingleMock,
                }),
              }),
            };
          },
        };
      }

      if (table === "crawl_runs") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: crawlRunSummaryMaybeSingleMock,
            }),
          }),
          update: crawlRunProgressUpdateMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

describe("page persistence idempotency", () => {
  beforeEach(() => {
    insertSingleMock.mockReset();
    pageLookupMaybeSingleMock.mockReset();
    pageCountHeadMock.mockReset();
    crawlRunSummaryMaybeSingleMock.mockReset();
    crawlRunProgressUpdateMock.mockReset();
    crawlRunProgressEqMock.mockReset();
    crawlRunProgressUpdateMock.mockReturnValue({ eq: crawlRunProgressEqMock });
    crawlRunProgressEqMock.mockResolvedValue({ error: null });
  });

  it("detects only the known requested-url unique constraint conflict", () => {
    expect(
      isPageRequestedUrlUniqueConflict({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "pages_crawl_run_requested_url_unique"',
      }),
    ).toBe(true);

    expect(
      isPageRequestedUrlUniqueConflict({
        code: "23505",
        message: 'duplicate key value violates unique constraint "other_unique"',
      }),
    ).toBe(false);

    expect(
      isPageRequestedUrlUniqueConflict({
        code: "42501",
        message: "permission denied",
      }),
    ).toBe(false);
  });

  it("returns the existing page id when the same requested URL is inserted twice", async () => {
    insertSingleMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "pages_crawl_run_requested_url_unique"',
      },
    });
    pageLookupMaybeSingleMock.mockResolvedValueOnce({
      data: { id: "page-existing", final_url: "http://www.example.com/page" },
      error: null,
    });

    const pageId = await saveParsedPage({
      crawlRunId: "run-1",
      websiteId: "website-1",
      parsed: parsedPage,
    });

    expect(pageId).toBe("page-existing");
  });

  it("throws unrelated page insert errors normally", async () => {
    insertSingleMock.mockResolvedValueOnce({
      data: null,
      error: {
        code: "42501",
        message: "permission denied for table pages",
      },
    });

    await expect(
      saveParsedPage({
        crawlRunId: "run-1",
        websiteId: "website-1",
        parsed: parsedPage,
      }),
    ).rejects.toThrow("Failed to save page: permission denied for table pages");
  });

  it("looks up pages by exact requested_url without collapsing http/https variants", async () => {
    pageLookupMaybeSingleMock.mockResolvedValueOnce({
      data: {
        id: "page-http",
        final_url: "http://www.example.com/page",
      },
      error: null,
    });

    const page = await findPageByRequestedUrl(
      "run-1",
      "http://www.example.com/page",
    );

    expect(page).toEqual({
      id: "page-http",
      finalUrl: "http://www.example.com/page",
    });
  });

  it("reconciles counter drift by incrementing once when pages exceed pages_crawled", async () => {
    crawlRunSummaryMaybeSingleMock.mockResolvedValueOnce({
      data: {
        id: "run-1",
        status: "running",
        seed_url: "https://example.com/",
        max_pages: 10,
        pages_crawled: 9,
        pages_discovered: 2,
        error_message: null,
        started_at: "2026-09-10T21:49:09.162+00:00",
        completed_at: null,
        created_at: "2026-09-10T21:47:05.507085+00:00",
        websites: { hostname: "example.com" },
      },
      error: null,
    });
    pageCountHeadMock.mockResolvedValueOnce({ count: 10, error: null });
    crawlRunSummaryMaybeSingleMock.mockResolvedValueOnce({
      data: {
        id: "run-1",
        status: "running",
        seed_url: "https://example.com/",
        max_pages: 10,
        pages_crawled: 9,
        pages_discovered: 2,
        error_message: null,
        started_at: "2026-09-10T21:49:09.162+00:00",
        completed_at: null,
        created_at: "2026-09-10T21:47:05.507085+00:00",
        websites: { hostname: "example.com" },
      },
      error: null,
    });
    const reconciled = await reconcileOrphanedPageProgress("run-1");

    expect(reconciled).toBe(true);
    expect(crawlRunProgressUpdateMock).toHaveBeenCalledWith({
      pages_crawled: 10,
      pages_discovered: 2,
    });
    expect(crawlRunProgressEqMock).toHaveBeenCalledWith("id", "run-1");
  });

  it("does not increment when the counter already matches persisted pages", async () => {
    crawlRunSummaryMaybeSingleMock.mockResolvedValueOnce({
      data: {
        id: "run-1",
        status: "running",
        seed_url: "https://example.com/",
        max_pages: 10,
        pages_crawled: 10,
        pages_discovered: 2,
        error_message: null,
        started_at: "2026-09-10T21:49:09.162+00:00",
        completed_at: null,
        created_at: "2026-09-10T21:47:05.507085+00:00",
        websites: { hostname: "example.com" },
      },
      error: null,
    });
    pageCountHeadMock.mockResolvedValueOnce({ count: 10, error: null });

    const reconciled = await reconcileOrphanedPageProgress("run-1");

    expect(reconciled).toBe(false);
    expect(crawlRunProgressUpdateMock).not.toHaveBeenCalled();
  });

  it("counts pages per crawl run only", async () => {
    pageCountHeadMock.mockResolvedValueOnce({ count: 3, error: null });

    await expect(countPagesForCrawlRun("run-1")).resolves.toBe(3);
  });
});
