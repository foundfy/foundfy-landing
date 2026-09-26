import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLatestCrawlActivityAt,
  incrementCrawlProgress,
  reconcileOrphanedPageProgress,
} from "./repository";

const runRow = {
  id: "run-1",
  website_id: "website-1",
  status: "running",
  seed_url: "https://example.com/",
  max_pages: 10,
  pages_crawled: 9,
  pages_discovered: 4,
  error_message: null,
  started_at: "2026-09-25T10:32:08.716Z",
  completed_at: null,
  created_at: "2026-09-25T10:32:00.000Z",
  websites: { hostname: "example.com" },
};

const summaryMaybeSingleMock = vi.fn();
const progressMaybeSingleMock = vi.fn();
const pageActivityMaybeSingleMock = vi.fn();
const artifactActivityMaybeSingleMock = vi.fn();
const pageCountHeadMock = vi.fn();
const progressChain = {
  eq: vi.fn(),
  is: vi.fn(),
  select: vi.fn(),
  maybeSingle: progressMaybeSingleMock,
};

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "pages") {
        return {
          select: (columns: string, options?: { count?: string; head?: boolean }) => {
            if (options?.head) {
              return {
                eq: () => pageCountHeadMock(),
              };
            }

            return {
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: pageActivityMaybeSingleMock,
                  }),
                }),
              }),
            };
          },
        };
      }

      if (table === "crawl_site_artifacts") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: artifactActivityMaybeSingleMock,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "crawl_runs") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: summaryMaybeSingleMock,
            }),
          }),
          update: () => progressChain,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

describe("crawl progress lease and cap", () => {
  beforeEach(() => {
    summaryMaybeSingleMock.mockReset();
    progressMaybeSingleMock.mockReset();
    pageActivityMaybeSingleMock.mockReset();
    artifactActivityMaybeSingleMock.mockReset();
    pageCountHeadMock.mockReset();
    progressChain.eq.mockReset();
    progressChain.is.mockReset();
    progressChain.select.mockReset();
    progressChain.eq.mockReturnValue(progressChain);
    progressChain.is.mockReturnValue(progressChain);
    progressChain.select.mockReturnValue(progressChain);
    progressMaybeSingleMock.mockResolvedValue({ data: { id: "run-1" }, error: null });
    summaryMaybeSingleMock.mockResolvedValue({ data: runRow, error: null });
  });

  it("caps pages_crawled at max_pages", async () => {
    summaryMaybeSingleMock.mockResolvedValue({
      data: { ...runRow, pages_crawled: 10 },
      error: null,
    });

    const applied = await incrementCrawlProgress("run-1", 1, 0, {
      expectedStartedAt: runRow.started_at,
    });

    expect(applied).toBe(false);
    expect(progressChain.eq).not.toHaveBeenCalled();
  });

  it("rejects progress writes after the claim lease is lost", async () => {
    const applied = await incrementCrawlProgress("run-1", 1, 0, {
      expectedStartedAt: "2026-09-25T10:34:08.716Z",
    });

    expect(applied).toBe(false);
    expect(progressChain.eq).not.toHaveBeenCalled();
  });

  it("uses the current pages_crawled value as an optimistic lock", async () => {
    const applied = await incrementCrawlProgress("run-1", 1, 0, {
      expectedStartedAt: runRow.started_at,
    });

    expect(applied).toBe(true);
    expect(progressChain.eq).toHaveBeenCalledWith("pages_crawled", 9);
    expect(progressChain.eq).toHaveBeenCalledWith("started_at", runRow.started_at);
  });

  it("does not apply a second overlapping increment past max_pages", async () => {
    progressMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });

    const applied = await incrementCrawlProgress("run-1", 1, 0, {
      expectedStartedAt: runRow.started_at,
    });

    expect(applied).toBe(false);
  });

  it("will not reconcile an already-counted page", async () => {
    summaryMaybeSingleMock.mockResolvedValue({
      data: { ...runRow, pages_crawled: 10 },
      error: null,
    });
    pageCountHeadMock.mockResolvedValue({ count: 10, error: null });

    const reconciled = await reconcileOrphanedPageProgress("run-1", {
      expectedStartedAt: runRow.started_at,
    });

    expect(reconciled).toBe(false);
  });

  it("uses the latest page or artifact fetched_at as worker activity", async () => {
    pageActivityMaybeSingleMock.mockResolvedValue({
      data: { fetched_at: "2026-09-25T10:33:56.000Z" },
      error: null,
    });
    artifactActivityMaybeSingleMock.mockResolvedValue({
      data: { fetched_at: "2026-09-25T10:32:09.000Z" },
      error: null,
    });

    await expect(getLatestCrawlActivityAt("run-1")).resolves.toBe(
      "2026-09-25T10:33:56.000Z",
    );
  });
});
