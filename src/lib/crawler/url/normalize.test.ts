import { describe, expect, it } from "vitest";
import {
  isSameSite,
  normalizeCrawlUrl,
  normalizeSiteHostname,
  validatePublicHttpUrl,
} from "./normalize";

describe("normalizeSiteHostname", () => {
  it("lowercases and strips www", () => {
    expect(normalizeSiteHostname("WWW.Example.COM")).toBe("example.com");
  });
});

describe("normalizeCrawlUrl", () => {
  it("removes fragments and tracking params", () => {
    expect(
      normalizeCrawlUrl("https://Example.com/page?utm_source=test#section"),
    ).toBe("https://example.com/page");
  });

  it("normalizes trailing slashes except root", () => {
    expect(normalizeCrawlUrl("https://example.com/about/")).toBe(
      "https://example.com/about",
    );
    expect(normalizeCrawlUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("resolves relative URLs against a base", () => {
    expect(normalizeCrawlUrl("/pricing", "https://foundfy.me/blog")).toBe(
      "https://foundfy.me/pricing",
    );
  });
});

describe("isSameSite", () => {
  it("treats www variants as the same site", () => {
    expect(isSameSite("https://www.foundfy.me/about", "foundfy.me")).toBe(true);
    expect(isSameSite("https://other.com", "foundfy.me")).toBe(false);
  });
});

describe("validatePublicHttpUrl", () => {
  it("accepts bare domains and returns normalized https URL", () => {
    const result = validatePublicHttpUrl("foundfy.me");
    expect(result).toEqual({
      url: "https://foundfy.me/",
      hostname: "foundfy.me",
    });
  });

  it("rejects localhost and invalid input", () => {
    expect(validatePublicHttpUrl("localhost")).toBeNull();
    expect(validatePublicHttpUrl("not a url")).toBeNull();
  });
});
