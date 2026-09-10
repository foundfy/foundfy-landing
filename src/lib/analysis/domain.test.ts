import { describe, expect, it } from "vitest";
import { normalizeDomainInput } from "./domain";

describe("normalizeDomainInput", () => {
  it("preserves www in the crawl seed URL", () => {
    const normalized = normalizeDomainInput("https://www.arngren.net");

    expect(normalized).toEqual({
      raw: "https://www.arngren.net",
      hostname: "arngren.net",
      url: "https://www.arngren.net/",
    });
  });

  it("keeps non-www seeds when the user entered a bare domain", () => {
    const normalized = normalizeDomainInput("arngren.net");

    expect(normalized).toEqual({
      raw: "arngren.net",
      hostname: "arngren.net",
      url: "https://arngren.net/",
    });
  });

  it("deduplicates website identity across www and non-www variants", () => {
    const withWww = normalizeDomainInput("https://www.example.com");
    const withoutWww = normalizeDomainInput("https://example.com");

    expect(withWww?.hostname).toBe("example.com");
    expect(withoutWww?.hostname).toBe("example.com");
    expect(withWww?.url).toBe("https://www.example.com/");
    expect(withoutWww?.url).toBe("https://example.com/");
  });
});
