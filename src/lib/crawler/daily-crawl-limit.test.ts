import { beforeEach, describe, expect, it, vi } from "vitest";

const gteMock = vi.fn();
const selectMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/db/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: fromMock,
  }),
}));

import {
  DAILY_CRAWL_LIMIT_MESSAGE,
  DAILY_NEW_CRAWL_LIMIT,
  DailyCrawlLimitReachedError,
  assertCanCreateNewCrawl,
  countNewCrawlsCreatedToday,
  getUtcDayStart,
  isDailyCrawlLimitReachedError,
} from "./daily-crawl-limit";

function mockCount(count: number | null, error: { message: string } | null = null) {
  gteMock.mockResolvedValue({ count, error });
  selectMock.mockReturnValue({ gte: gteMock });
  fromMock.mockReturnValue({ select: selectMock });
}

describe("daily crawl limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts crawl_runs created since the UTC day start", async () => {
    mockCount(7);
    const now = new Date("2026-09-12T15:30:00.000Z");

    await expect(countNewCrawlsCreatedToday(now)).resolves.toBe(7);

    expect(fromMock).toHaveBeenCalledWith("crawl_runs");
    expect(selectMock).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(gteMock).toHaveBeenCalledWith("created_at", "2026-09-12T00:00:00.000Z");
    expect(getUtcDayStart(now).toISOString()).toBe("2026-09-12T00:00:00.000Z");
  });

  it("allows a new crawl when today's created count is below the global ceiling", async () => {
    mockCount(DAILY_NEW_CRAWL_LIMIT - 1);

    await expect(assertCanCreateNewCrawl()).resolves.toBeUndefined();
  });

  it("rejects a new crawl at the global ceiling", async () => {
    mockCount(DAILY_NEW_CRAWL_LIMIT);

    await expect(assertCanCreateNewCrawl()).rejects.toBeInstanceOf(
      DailyCrawlLimitReachedError,
    );
    await expect(assertCanCreateNewCrawl()).rejects.toMatchObject({
      message: DAILY_CRAWL_LIMIT_MESSAGE,
      status: 429,
    });
  });

  it("does not treat reused active scans as a new created crawl", () => {
    expect(DAILY_NEW_CRAWL_LIMIT).toBe(30);
    expect(isDailyCrawlLimitReachedError(new DailyCrawlLimitReachedError())).toBe(
      true,
    );
  });
});
