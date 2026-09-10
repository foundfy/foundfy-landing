import { describe, expect, it } from "vitest";
import {
  isUsableCompletedCrawl,
  normalizeCrawlStatusForApiResponse,
  ZERO_PAGE_CRAWL_FAILURE_MESSAGE,
} from "./crawl-usability";

describe("crawl usability", () => {
  it("treats only completed runs with pages as usable", () => {
    expect(isUsableCompletedCrawl({ status: "completed", pagesCrawled: 3 })).toBe(
      true,
    );
    expect(isUsableCompletedCrawl({ status: "completed", pagesCrawled: 0 })).toBe(
      false,
    );
    expect(isUsableCompletedCrawl({ status: "failed", pagesCrawled: 0 })).toBe(
      false,
    );
  });

  it("normalizes legacy completed zero-page runs to failed API responses", () => {
    const normalized = normalizeCrawlStatusForApiResponse({
      status: "completed",
      pagesCrawled: 0,
      errorMessage: null,
    });

    expect(normalized.status).toBe("failed");
    expect(normalized.errorMessage).toBe(ZERO_PAGE_CRAWL_FAILURE_MESSAGE);
  });
});
