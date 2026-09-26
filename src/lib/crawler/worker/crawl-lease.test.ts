import { describe, expect, it } from "vitest";
import { CrawlLeaseLostError, isCurrentCrawlLease } from "./crawl-lease";

describe("crawl worker lease", () => {
  it("matches only the current running claim", () => {
    expect(
      isCurrentCrawlLease(
        { status: "running", startedAt: "2026-09-25T10:32:08.716Z" },
        "2026-09-25T10:32:08.716Z",
      ),
    ).toBe(true);
  });

  it("treats a later claim as lease loss", () => {
    expect(
      isCurrentCrawlLease(
        { status: "running", startedAt: "2026-09-25T10:34:08.716Z" },
        "2026-09-25T10:32:08.716Z",
      ),
    ).toBe(false);
    expect(
      isCurrentCrawlLease(
        { status: "queued", startedAt: null },
        "2026-09-25T10:32:08.716Z",
      ),
    ).toBe(false);
    expect(isCurrentCrawlLease(null, "2026-09-25T10:32:08.716Z")).toBe(false);
  });

  it("names lease-loss errors without exposing internals", () => {
    const error = new CrawlLeaseLostError("ec315f14-6e38-4bcc-acdc-1d5f63ee5e11");
    expect(error.name).toBe("CrawlLeaseLostError");
    expect(error.message).toBe("Crawl worker lease lost.");
    expect(error.crawlRunId).toBe("ec315f14-6e38-4bcc-acdc-1d5f63ee5e11");
  });
});
