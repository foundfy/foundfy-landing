import { describe, expect, it } from "vitest";
import { extractUrlLocale } from "./url-locale";

describe("url locale", () => {
  it("reads a path locale separately from content language", () => {
    expect(extractUrlLocale("https://example.com/ca/la-seda")).toBe("ca");
    expect(extractUrlLocale("https://example.com/es/nosotros")).toBe("es");
    expect(extractUrlLocale("https://example.com/hakkimizda")).toBeNull();
    expect(extractUrlLocale("https://example.com/blog")).toBeNull();
    expect(extractUrlLocale("https://example.com/")).toBeNull();
  });
});
