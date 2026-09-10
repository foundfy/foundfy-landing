import { afterEach, describe, expect, it, vi } from "vitest";
import { maybeRecoverStaleCrawlRun } from "./recover-stale-run";
import type { CrawlRunSummary } from "../types";

const getCrawlRunSummaryMock = vi.fn();
const requeueStaleRunningCrawlRunMock = vi.fn();
const resetAbandonedProcessingQueueItemsMock = vi.fn();

vi.mock("../db/repository", () => ({
  getCrawlRunSummary: (...args: unknown[]) => getCrawlRunSummaryMock(...args),
  requeueStaleRunningCrawlRun: (...args: unknown[]) =>
    requeueStaleRunningCrawlRunMock(...args),
  resetAbandonedProcessingQueueItems: (...args: unknown[]) =>
    resetAbandonedProcessingQueueItemsMock(...args),
}));

function runningSummary(overrides: Partial<CrawlRunSummary> = {}): CrawlRunSummary {
  return {
    id: "run-1",
    status: "running",
    hostname: "example.com",
    seedUrl: "https://example.com/",
    maxPages: 10,
    pagesCrawled: 1,
    pagesDiscovered: 5,
    errorMessage: null,
    startedAt: "2026-09-10T15:00:00.000Z",
    completedAt: null,
    createdAt: "2026-09-10T14:59:59.000Z",
    ...overrides,
  };
}

afterEach(() => {
  getCrawlRunSummaryMock.mockReset();
  requeueStaleRunningCrawlRunMock.mockReset();
  resetAbandonedProcessingQueueItemsMock.mockReset();
  vi.useRealTimers();
});

describe("maybeRecoverStaleCrawlRun", () => {
  it("does not reclaim a recent healthy running crawl", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T15:01:00.000Z"));

    getCrawlRunSummaryMock.mockResolvedValue(
      runningSummary({ startedAt: "2026-09-10T15:00:30.000Z" }),
    );

    const result = await maybeRecoverStaleCrawlRun("run-1");

    expect(result).toEqual({ recovered: false });
    expect(requeueStaleRunningCrawlRunMock).not.toHaveBeenCalled();
    expect(resetAbandonedProcessingQueueItemsMock).not.toHaveBeenCalled();
  });

  it("atomically reclaims a stale running crawl", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T15:05:00.000Z"));

    getCrawlRunSummaryMock.mockResolvedValue(
      runningSummary({ startedAt: "2026-09-10T15:00:00.000Z" }),
    );
    requeueStaleRunningCrawlRunMock.mockResolvedValue(true);
    resetAbandonedProcessingQueueItemsMock.mockResolvedValue(1);

    const result = await maybeRecoverStaleCrawlRun("run-1");

    expect(result).toEqual({ recovered: true });
    expect(requeueStaleRunningCrawlRunMock).toHaveBeenCalledWith(
      "run-1",
      "2026-09-10T15:03:00.000Z",
    );
    expect(resetAbandonedProcessingQueueItemsMock).toHaveBeenCalledWith("run-1");
  });

  it("does not reset queue items when the atomic reclaim loses the race", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T15:05:00.000Z"));

    getCrawlRunSummaryMock.mockResolvedValue(
      runningSummary({ startedAt: "2026-09-10T15:00:00.000Z" }),
    );
    requeueStaleRunningCrawlRunMock.mockResolvedValue(false);

    const result = await maybeRecoverStaleCrawlRun("run-1");

    expect(result).toEqual({ recovered: false });
    expect(resetAbandonedProcessingQueueItemsMock).not.toHaveBeenCalled();
  });

  it("is idempotent when a concurrent poll already recovered the run", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T15:05:00.000Z"));

    getCrawlRunSummaryMock.mockResolvedValueOnce(
      runningSummary({ startedAt: "2026-09-10T15:00:00.000Z" }),
    );
    requeueStaleRunningCrawlRunMock.mockResolvedValue(false);

    const first = await maybeRecoverStaleCrawlRun("run-1");

    getCrawlRunSummaryMock.mockResolvedValueOnce(
      runningSummary({ status: "queued", startedAt: null }),
    );

    const second = await maybeRecoverStaleCrawlRun("run-1");

    expect(first).toEqual({ recovered: false });
    expect(second).toEqual({ recovered: false });
    expect(requeueStaleRunningCrawlRunMock).toHaveBeenCalledTimes(1);
  });

  it("never recovers completed crawls", async () => {
    getCrawlRunSummaryMock.mockResolvedValue(
      runningSummary({
        status: "completed",
        completedAt: "2026-09-10T15:10:00.000Z",
      }),
    );

    const result = await maybeRecoverStaleCrawlRun("run-1");

    expect(result).toEqual({ recovered: false });
    expect(requeueStaleRunningCrawlRunMock).not.toHaveBeenCalled();
  });

  it("never recovers failed crawls", async () => {
    getCrawlRunSummaryMock.mockResolvedValue(
      runningSummary({
        status: "failed",
        errorMessage: "boom",
        completedAt: "2026-09-10T15:10:00.000Z",
      }),
    );

    const result = await maybeRecoverStaleCrawlRun("run-1");

    expect(result).toEqual({ recovered: false });
    expect(requeueStaleRunningCrawlRunMock).not.toHaveBeenCalled();
  });

  it("preserves done and failed queue items by only resetting processing items after reclaim", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T15:05:00.000Z"));

    getCrawlRunSummaryMock.mockResolvedValue(
      runningSummary({ startedAt: "2026-09-10T15:00:00.000Z" }),
    );
    requeueStaleRunningCrawlRunMock.mockResolvedValue(true);
    resetAbandonedProcessingQueueItemsMock.mockResolvedValue(1);

    await maybeRecoverStaleCrawlRun("run-1");

    expect(resetAbandonedProcessingQueueItemsMock).toHaveBeenCalledWith("run-1");
    expect(resetAbandonedProcessingQueueItemsMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "done" }),
    );
  });

  it("allows only one concurrent recovery attempt to win", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T15:05:00.000Z"));

    getCrawlRunSummaryMock.mockResolvedValue(
      runningSummary({ startedAt: "2026-09-10T15:00:00.000Z" }),
    );
    requeueStaleRunningCrawlRunMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    resetAbandonedProcessingQueueItemsMock.mockResolvedValue(1);

    const [first, second] = await Promise.all([
      maybeRecoverStaleCrawlRun("run-1"),
      maybeRecoverStaleCrawlRun("run-1"),
    ]);

    expect(first.recovered || second.recovered).toBe(true);
    expect(first.recovered && second.recovered).toBe(false);
    expect(resetAbandonedProcessingQueueItemsMock).toHaveBeenCalledTimes(1);
  });
});
