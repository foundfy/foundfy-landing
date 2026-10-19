import { beforeEach, describe, expect, it, vi } from "vitest";

const eqMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();
const markCrawlRunFailedMock = vi.fn();

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: fromMock,
  }),
}));

vi.mock("../db/repository", () => ({
  markCrawlRunFailed: (...args: unknown[]) => markCrawlRunFailedMock(...args),
}));

import { reclaimStaleCrawlRuns } from "./reclaim-stale";

describe("reclaimStaleCrawlRuns purpose isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockImplementation((column: string) => {
      if (column === "purpose") {
        return Promise.resolve({ data: [], error: null });
      }
      return { eq: eqMock };
    });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });
  });

  it("lists only site_sample queued and running crawls", async () => {
    await reclaimStaleCrawlRuns();

    expect(fromMock).toHaveBeenCalledWith("crawl_runs");
    expect(eqMock).toHaveBeenCalledWith("status", "queued");
    expect(eqMock).toHaveBeenCalledWith("status", "running");
    expect(eqMock).toHaveBeenCalledWith("purpose", "site_sample");
    expect(markCrawlRunFailedMock).not.toHaveBeenCalled();
  });
});
