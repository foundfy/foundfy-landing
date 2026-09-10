import { afterEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn();

function buildQueryChain() {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.neq = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
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

  it("returns the immediately previous completed crawl", async () => {
    maybeSingleMock
      .mockResolvedValueOnce({
        data: { completed_at: "2026-01-02T00:00:00.000Z" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: "prev-run",
          completed_at: "2026-01-01T00:00:00.000Z",
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
    expect(fromMock).toHaveBeenCalledTimes(2);
  });
});
