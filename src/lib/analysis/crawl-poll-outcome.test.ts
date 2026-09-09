import { describe, expect, it } from "vitest";
import { resolveCrawlPollOutcome } from "./crawl-poll-outcome";

describe("resolveCrawlPollOutcome", () => {
  it("continues polling for queued and running statuses", () => {
    expect(resolveCrawlPollOutcome("queued")).toBe("continue");
    expect(resolveCrawlPollOutcome("running")).toBe("continue");
  });

  it("stops polling when the crawl completes or fails", () => {
    expect(resolveCrawlPollOutcome("completed")).toBe("completed");
    expect(resolveCrawlPollOutcome("failed")).toBe("failed");
  });
});
