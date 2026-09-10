import { describe, expect, it } from "vitest";
import { normalizeComparisonUrl } from "./normalize-comparison-url";

describe("normalizeComparisonUrl", () => {
  it("strips www for cross-run consistency", () => {
    expect(normalizeComparisonUrl("https://www.example.com/about")).toBe(
      "https://example.com/about",
    );
    expect(normalizeComparisonUrl("https://example.com/about")).toBe(
      "https://example.com/about",
    );
  });

  it("keeps http and https distinct", () => {
    expect(normalizeComparisonUrl("http://example.com/about")).toBe(
      "http://example.com/about",
    );
    expect(normalizeComparisonUrl("https://example.com/about")).toBe(
      "https://example.com/about",
    );
  });

  it("normalizes trailing slashes and tracking params", () => {
    expect(
      normalizeComparisonUrl("https://example.com/about/?utm_source=test"),
    ).toBe("https://example.com/about");
  });
});
