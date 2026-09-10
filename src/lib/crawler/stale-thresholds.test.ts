import { describe, expect, it } from "vitest";
import {
  CRAWL_FUNCTION_MAX_DURATION_SECONDS,
  isRunningCrawlStale,
  POLL_RUNNING_STALE_MS,
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
});
