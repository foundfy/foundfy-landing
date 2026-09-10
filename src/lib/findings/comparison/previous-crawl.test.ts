import { afterEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn();
const gtMock = vi.fn();

function buildQueryChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.neq = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.gt = gtMock.mockImplementation(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = maybeSingleMock;
  return chain;
}

const fromMock = vi.fn(() => buildQueryChain());

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: fromMock,
  }),
}));

describe("findPreviousCompletedCrawlRun", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the current crawl is not completed", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });

    const { findPreviousCompletedCrawlRun } = await import("./previous-crawl");
    const result = await findPreviousCompletedCrawlRun({
      websiteId: "site-1",
      currentCrawlRunId: "current-run",
    });

    expect(result).toBeNull();
  });

  it("returns the immediately previous usable completed crawl", async () => {
    maybeSingleMock
      .mockResolvedValueOnce({
        data: { completed_at: "2026-01-02T00:00:00.000Z" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "prev-run",
          completed_at: "2026-01-01T00:00:00.000Z",
          pages_crawled: 10,
        },
        error: null,
      });

    const { findPreviousCompletedCrawlRun } = await import("./previous-crawl");
    const result = await findPreviousCompletedCrawlRun({
      websiteId: "site-1",
      currentCrawlRunId: "current-run",
    });

    expect(result).toEqual({
      id: "prev-run",
      completedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(gtMock).toHaveBeenCalledWith("pages_crawled", 0);
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("walks back past zero-page completed runs via pages_crawled filter", async () => {
    maybeSingleMock
      .mockResolvedValueOnce({
        data: { completed_at: "2026-09-10T21:20:00.000Z" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "2dfa4485-ded9-4cae-911f-3a62cf199d3c",
          completed_at: "2026-09-10T21:15:24.461+00:00",
          pages_crawled: 10,
        },
        error: null,
      });

    const { findPreviousCompletedCrawlRun } = await import("./previous-crawl");
    const result = await findPreviousCompletedCrawlRun({
      websiteId: "site-arngren",
      currentCrawlRunId: "new-run-after-zero-page",
    });

    expect(result?.id).toBe("2dfa4485-ded9-4cae-911f-3a62cf199d3c");
    expect(gtMock).toHaveBeenCalledWith("pages_crawled", 0);
  });
});
