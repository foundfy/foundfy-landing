import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: null | { message: string } };

const websiteSelectMock = vi.fn();
const crawlRunsSelectMock = vi.fn();
const eqMock = vi.fn();
const inMock = vi.fn();
const gtMock = vi.fn();
const orderMock = vi.fn();
const limitMock = vi.fn();
const maybeSingleMock = vi.fn();

function chain() {
  return {
    eq: eqMock,
    in: inMock,
    gt: gtMock,
    order: orderMock,
    limit: limitMock,
    maybeSingle: maybeSingleMock,
  };
}

const fromMock = vi.fn((table: string) => {
  if (table === "websites") {
    return {
      select: websiteSelectMock,
    };
  }

  if (table === "crawl_runs") {
    return {
      select: crawlRunsSelectMock,
    };
  }

  throw new Error(`Unexpected table: ${table}`);
});

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: fromMock,
  }),
}));

import {
  findActiveCrawlRunForWebsite,
  findLatestUsableCrawlRun,
  isUsableWebsiteCrawlRun,
  listCrawlRunsForWebsite,
} from "./repository";

describe("website repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue(chain());
    inMock.mockReturnValue(chain());
    gtMock.mockReturnValue(chain());
    orderMock.mockReturnValue(chain());
    limitMock.mockReturnValue(chain());
    maybeSingleMock.mockResolvedValue({ data: null, error: null } satisfies QueryResult);
    crawlRunsSelectMock.mockReturnValue(chain());
  });

  it("treats legacy zero-page completed runs as not usable", () => {
    expect(
      isUsableWebsiteCrawlRun({
        id: "run-legacy",
        websiteId: "website-1",
        status: "failed",
        seedUrl: "https://example.com/",
        pagesCrawled: 0,
        maxPages: 10,
        errorMessage: "We couldn't successfully crawl any pages from this website.",
        startedAt: null,
        completedAt: "2026-09-10T15:00:00.000Z",
        createdAt: "2026-09-10T14:59:59.000Z",
      }),
    ).toBe(false);
  });

  it("findLatestUsableCrawlRun queries completed site_sample runs with pages crawled", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "run-usable",
        website_id: "website-1",
        status: "completed",
        seed_url: "https://www.example.com/",
        purpose: "site_sample",
        max_pages: 10,
        pages_crawled: 10,
        error_message: null,
        started_at: "2026-09-10T15:00:00.000Z",
        completed_at: "2026-09-10T15:01:00.000Z",
        created_at: "2026-09-10T14:59:59.000Z",
      },
      error: null,
    });

    const run = await findLatestUsableCrawlRun("website-1");

    expect(run?.id).toBe("run-usable");
    expect(eqMock).toHaveBeenCalledWith("website_id", "website-1");
    expect(eqMock).toHaveBeenCalledWith("purpose", "site_sample");
    expect(eqMock).toHaveBeenCalledWith("status", "completed");
  });

  it("findActiveCrawlRunForWebsite returns the newest queued or running site_sample crawl", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        id: "run-active",
        website_id: "website-1",
        status: "running",
        seed_url: "https://example.com/",
        purpose: "site_sample",
        max_pages: 10,
        pages_crawled: 2,
        error_message: null,
        started_at: "2026-09-10T15:00:00.000Z",
        completed_at: null,
        created_at: "2026-09-10T14:59:59.000Z",
      },
      error: null,
    });

    const run = await findActiveCrawlRunForWebsite("website-1");

    expect(run?.id).toBe("run-active");
    expect(run?.status).toBe("running");
    expect(eqMock).toHaveBeenCalledWith("purpose", "site_sample");
    expect(inMock).toHaveBeenCalledWith("status", ["queued", "running"]);
  });

  it("listCrawlRunsForWebsite normalizes legacy zero-page completed runs to failed", async () => {
    limitMock.mockResolvedValue({
      data: [
        {
          id: "run-failed-newer",
          website_id: "website-1",
          status: "failed",
          seed_url: "https://example.com/",
          purpose: "site_sample",
          max_pages: 10,
          pages_crawled: 0,
          error_message: "timeout",
          started_at: "2026-09-11T15:00:00.000Z",
          completed_at: "2026-09-11T15:01:00.000Z",
          created_at: "2026-09-11T14:59:59.000Z",
        },
        {
          id: "run-usable",
          website_id: "website-1",
          status: "completed",
          seed_url: "https://example.com/",
          purpose: "site_sample",
          max_pages: 10,
          pages_crawled: 10,
          error_message: null,
          started_at: "2026-09-10T15:00:00.000Z",
          completed_at: "2026-09-10T15:01:00.000Z",
          created_at: "2026-09-10T14:59:59.000Z",
        },
        {
          id: "run-legacy-zero",
          website_id: "website-1",
          status: "completed",
          seed_url: "https://example.com/",
          purpose: "site_sample",
          max_pages: 10,
          pages_crawled: 0,
          error_message: null,
          started_at: "2026-09-09T15:00:00.000Z",
          completed_at: "2026-09-09T15:01:00.000Z",
          created_at: "2026-09-09T14:59:59.000Z",
        },
      ],
      error: null,
    });

    const runs = await listCrawlRunsForWebsite("website-1");

    expect(runs.map((run) => run.id)).toEqual([
      "run-failed-newer",
      "run-usable",
      "run-legacy-zero",
    ]);
    expect(eqMock).toHaveBeenCalledWith("purpose", "site_sample");
    expect(runs[0]?.status).toBe("failed");
    expect(runs[1]?.status).toBe("completed");
    expect(runs[2]?.status).toBe("failed");
    expect(runs[2]?.errorMessage).toContain("couldn't successfully crawl any pages");
  });
});
