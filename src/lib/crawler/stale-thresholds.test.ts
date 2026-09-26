import { describe, expect, it } from "vitest";
import {
  CRAWL_FUNCTION_MAX_DURATION_SECONDS,
  isRecentWorkerActivity,
  isRunningCrawlStale,
  POLL_RUNNING_STALE_MS,
  shouldRecoverRunningCrawl,
} from "./stale-thresholds";

describe("stale thresholds", () => {
  it("uses a poll threshold tied to the serverless execution cap", () => {
    expect(POLL_RUNNING_STALE_MS).toBe(CRAWL_FUNCTION_MAX_DURATION_SECONDS * 2 * 1000);
  });

  it("treats recent running crawls as healthy", () => {
    const now = Date.parse("2026-09-10T15:30:00.000Z");
    const startedAt = "2026-09-10T15:29:30.000Z";

    expect(isRunningCrawlStale(startedAt, now)).toBe(false);
  });

  it("treats stale running crawls as abandoned", () => {
    const now = Date.parse("2026-09-10T15:30:00.000Z");
    const startedAt = "2026-09-10T15:27:00.000Z";

    expect(isRunningCrawlStale(startedAt, now)).toBe(true);
  });

  it("treats missing started_at on a running run as stale", () => {
    expect(isRunningCrawlStale(null)).toBe(true);
  });

  it("treats recent page or artifact activity as live worker progress", () => {
    const now = Date.parse("2026-09-25T10:34:08.000Z");
    expect(isRecentWorkerActivity("2026-09-25T10:33:56.000Z", now)).toBe(true);
    expect(isRecentWorkerActivity("2026-09-25T10:32:08.000Z", now)).toBe(false);
    expect(isRecentWorkerActivity(null, now)).toBe(false);
  });

  it("does not recover a long-running worker with recent page progress", () => {
    const now = Date.parse("2026-09-25T10:34:08.000Z");
    expect(
      shouldRecoverRunningCrawl({
        startedAt: "2026-09-25T10:32:08.000Z",
        lastActivityAt: "2026-09-25T10:33:56.000Z",
        nowMs: now,
      }),
    ).toBe(false);
  });

  it("recovers a genuinely abandoned running crawl with no recent activity", () => {
    const now = Date.parse("2026-09-25T10:34:08.000Z");
    expect(
      shouldRecoverRunningCrawl({
        startedAt: "2026-09-25T10:32:08.000Z",
        lastActivityAt: "2026-09-25T10:31:05.000Z",
        nowMs: now,
      }),
    ).toBe(true);
    expect(
      shouldRecoverRunningCrawl({
        startedAt: "2026-09-25T10:32:08.000Z",
        lastActivityAt: null,
        nowMs: now,
      }),
    ).toBe(true);
  });

  it("does not treat a single URL timeout as staleness when earlier pages are recent", () => {
    const now = Date.parse("2026-09-25T10:33:40.000Z");
    expect(
      shouldRecoverRunningCrawl({
        startedAt: "2026-09-25T10:32:08.000Z",
        lastActivityAt: "2026-09-25T10:33:21.000Z",
        nowMs: now,
      }),
    ).toBe(false);
  });
});
