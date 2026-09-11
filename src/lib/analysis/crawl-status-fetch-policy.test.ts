import { describe, expect, it } from "vitest";
import {
  isTerminalCrawlStatusHttpError,
  isTransientCrawlStatusHttpError,
  MAX_CONSECUTIVE_TRANSIENT_CRAWL_STATUS_FAILURES,
  shouldRetryTransientCrawlStatusFailure,
} from "./crawl-status-fetch-policy";

describe("crawl-status-fetch-policy", () => {
  it("treats common server and gateway errors as transient", () => {
    expect(isTransientCrawlStatusHttpError(500)).toBe(true);
    expect(isTransientCrawlStatusHttpError(502)).toBe(true);
    expect(isTransientCrawlStatusHttpError(503)).toBe(true);
    expect(isTransientCrawlStatusHttpError(504)).toBe(true);
  });

  it("treats client errors as terminal", () => {
    expect(isTerminalCrawlStatusHttpError(400)).toBe(true);
    expect(isTerminalCrawlStatusHttpError(404)).toBe(true);
    expect(isTerminalCrawlStatusHttpError(429)).toBe(true);
  });

  it("retries transient failures up to the configured limit", () => {
    for (let attempt = 1; attempt < MAX_CONSECUTIVE_TRANSIENT_CRAWL_STATUS_FAILURES; attempt += 1) {
      expect(shouldRetryTransientCrawlStatusFailure(attempt)).toBe(true);
    }

    expect(
      shouldRetryTransientCrawlStatusFailure(
        MAX_CONSECUTIVE_TRANSIENT_CRAWL_STATUS_FAILURES,
      ),
    ).toBe(false);
  });
});
