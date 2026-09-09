import { describe, expect, it } from "vitest";
import {
  getCrawlStatusCopy,
  getProgressTarget,
} from "./crawl-progress";

describe("getCrawlStatusCopy", () => {
  it("returns lifecycle-specific copy", () => {
    expect(getCrawlStatusCopy("queued")).toBe("Preparing crawl");
    expect(getCrawlStatusCopy("running")).toBe(
      "Crawling pages · checking structure",
    );
    expect(getCrawlStatusCopy("completed")).toBe("Analysis complete");
  });
});

describe("getProgressTarget", () => {
  it("never reaches completion before the crawl completes", () => {
    expect(getProgressTarget("queued", 0, 10, 0)).toBeLessThan(1);
    expect(getProgressTarget("running", 1, 10, 5_000)).toBeLessThan(1);
    expect(getProgressTarget("running", 10, 10, 60_000)).toBeLessThan(1);
  });

  it("only reaches 100% when completed", () => {
    expect(getProgressTarget("completed", 1, 10, 0)).toBe(1);
  });
});
