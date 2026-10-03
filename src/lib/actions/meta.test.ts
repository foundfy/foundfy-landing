import { describe, expect, it } from "vitest";
import { metaValuesEqual, normalizeMetaDescription } from "./meta";

describe("meta description comparison", () => {
  it("normalizes absence to null and compares trimmed values", () => {
    expect(normalizeMetaDescription("")).toBeNull();
    expect(normalizeMetaDescription("   ")).toBeNull();
    expect(metaValuesEqual("  Hello   world ", "Hello world")).toBe(true);
    expect(metaValuesEqual(null, "")).toBe(true);
    expect(metaValuesEqual("a", "b")).toBe(false);
  });
});
