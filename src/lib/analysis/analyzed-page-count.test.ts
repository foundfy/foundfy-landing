import { describe, expect, it } from "vitest";
import { analyzedPageCountForCopy } from "./analyzed-page-count";

describe("analyzedPageCountForCopy", () => {
  it("prefers persisted page rows and never exceeds max_pages", () => {
    expect(
      analyzedPageCountForCopy({
        pagesCrawled: 11,
        maxPages: 10,
        persistedPageCount: 10,
      }),
    ).toBe(10);
  });

  it("falls back to a capped counter when no persisted count is available", () => {
    expect(
      analyzedPageCountForCopy({
        pagesCrawled: 11,
        maxPages: 10,
      }),
    ).toBe(10);
  });
});
