import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: null | { message: string } };

const websiteSelectMock = vi.fn();
const crawlRunsSelectMock = vi.fn();

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

function createSelectChain(result: QueryResult) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const limit = vi.fn(() => ({ maybeSingle }));
  const orderSecond = vi.fn(() => ({ limit }));
  const orderFirst = vi.fn(() => ({ order: orderSecond }));
  const gt = vi.fn(() => ({ order: orderFirst }));
  const eqStatus = vi.fn(() => ({ gt, order: orderFirst, in: vi.fn(() => ({ order: orderFirst, limit })) }));
  const eqWebsite = vi.fn(() => ({
    eq: eqStatus,
    gt,
    in: eqStatus,
    order: orderFirst,
    limit,
  }));
  const eqId = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq: eqWebsite, eq: eqId }));

  return {
    select,
    eqWebsite,
    eqStatus,
    orderFirst,
    limit,
    maybeSingle,
  };
}

describe("website repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("findLatestUsableCrawlRun queries completed runs with pages crawled", async () => {
    const chain = createSelectChain({
      data: {
        id: "run-usable",
        website_id: "website-1",
        status: "completed",
        seed_url: "https://www.example.com/",
        max_pages: 10,
        pages_crawled: 10,
        error_message: null,
        started_at: "2026-09-10T15:00:00.000Z",
        completed_at: "2026-09-10T15:01:00.000Z",
        created_at: "2026-09-10T14:59:59.000Z",
      },
      error: null,
    });
    crawlRunsSelectMock.mockReturnValue({ eq: chain.eqWebsite });

    const run = await findLatestUsableCrawlRun("website-1");

    expect(run?.id).toBe("run-usable");
    expect(chain.eqWebsite).toHaveBeenCalledWith("website_id", "website-1");
  });

  it("findActiveCrawlRunForWebsite returns the newest queued or running crawl", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "run-active",
        website_id: "website-1",
        status: "running",
        seed_url: "https://example.com/",
        max_pages: 10,
        pages_crawled: 2,
        error_message: null,
        started_at: "2026-09-10T15:00:00.000Z",
        completed_at: null,
        created_at: "2026-09-10T14:59:59.000Z",
      },
      error: null,
    });
    const limit = vi.fn(() => ({ maybeSingle }));
    const order = vi.fn(() => ({ limit }));
    const inStatus = vi.fn(() => ({ order }));
    const eqWebsite = vi.fn(() => ({ in: inStatus }));
    crawlRunsSelectMock.mockReturnValue({ eq: eqWebsite });

    const run = await findActiveCrawlRunForWebsite("website-1");

    expect(run?.id).toBe("run-active");
    expect(run?.status).toBe("running");
    expect(inStatus).toHaveBeenCalledWith("status", ["queued", "running"]);
  });

  it("listCrawlRunsForWebsite normalizes legacy zero-page completed runs to failed", async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "run-failed-newer",
          website_id: "website-1",
          status: "failed",
          seed_url: "https://example.com/",
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
    const order = vi.fn(() => ({ limit }));
    const eqWebsite = vi.fn(() => ({ order }));
    crawlRunsSelectMock.mockReturnValue({ eq: eqWebsite });

    const runs = await listCrawlRunsForWebsite("website-1");

    expect(runs.map((run) => run.id)).toEqual([
      "run-failed-newer",
      "run-usable",
      "run-legacy-zero",
    ]);
    expect(runs[0]?.status).toBe("failed");
    expect(runs[1]?.status).toBe("completed");
    expect(runs[2]?.status).toBe("failed");
    expect(runs[2]?.errorMessage).toContain("couldn't successfully crawl any pages");
  });
});
