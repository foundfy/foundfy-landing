import { describe, expect, it } from "vitest";
import {
  canInspectUrl,
  normalizeInspectionUrl,
  selectInspectionUrls,
  urlBelongsToFoundfyWebsite,
  urlContainedInGscProperty,
} from "./indexing-urls";

const SELCUK = { hostname: "selcukdemirci.me" };
const SELCUK_PAGES = [
  {
    requestedUrl: "https://selcukdemirci.me/",
    finalUrl: "https://selcukdemirci.me/",
    statusCode: 200,
  },
  {
    requestedUrl: "https://selcukdemirci.me/about",
    finalUrl: "https://selcukdemirci.me/about",
    statusCode: 200,
  },
  {
    requestedUrl: "https://selcukdemirci.me/contact",
    finalUrl: "https://selcukdemirci.me/contact",
    statusCode: 200,
  },
];

describe("inspection URL selection", () => {
  it("normalizes http(s) URLs and rejects unsafe values", () => {
    expect(normalizeInspectionUrl("https://selcukdemirci.me/about#team")).toBe(
      "https://selcukdemirci.me/about",
    );
    expect(normalizeInspectionUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeInspectionUrl("not-a-url")).toBeNull();
  });

  it("requires the URL to belong to the Foundfy website and the bound GSC property", () => {
    expect(urlBelongsToFoundfyWebsite("https://selcukdemirci.me/about", SELCUK)).toBe(true);
    expect(urlBelongsToFoundfyWebsite("https://www.selcukdemirci.me/", SELCUK)).toBe(true);
    expect(urlBelongsToFoundfyWebsite("https://blog.selcukdemirci.me/", SELCUK)).toBe(false);
    expect(urlContainedInGscProperty("https://blog.selcukdemirci.me/", "sc-domain:selcukdemirci.me")).toBe(
      true,
    );
    expect(
      canInspectUrl("https://blog.selcukdemirci.me/", SELCUK, "sc-domain:selcukdemirci.me"),
    ).toBe(false);
    expect(
      canInspectUrl("https://selcukdemirci.me/about", SELCUK, "https://other.example/"),
    ).toBe(false);
    expect(
      canInspectUrl("https://selcukdemirci.me/about", SELCUK, "https://selcukdemirci.me/"),
    ).toBe(true);
  });

  it("does not treat a sibling host as inside a URL-prefix property", () => {
    expect(
      urlContainedInGscProperty("https://blog.example.com/", "https://example.com/"),
    ).toBe(false);
    expect(urlContainedInGscProperty("https://example.com/about", "https://example.com/")).toBe(
      true,
    );
  });

  it("selects the selcuk homepage first and at most two other important fetched URLs", () => {
    const selected = selectInspectionUrls({
      pages: [
        ...SELCUK_PAGES,
        {
          requestedUrl: "https://selcukdemirci.me/blog/post",
          finalUrl: "https://selcukdemirci.me/blog/post",
          statusCode: 200,
        },
        {
          requestedUrl: "https://other.example/",
          finalUrl: "https://other.example/",
          statusCode: 200,
        },
      ],
      website: SELCUK,
      propertyUri: "sc-domain:selcukdemirci.me",
    });

    expect(selected).toEqual([
      { url: "https://selcukdemirci.me/", role: "homepage" },
      { url: "https://selcukdemirci.me/about", role: "important_page" },
      { url: "https://selcukdemirci.me/contact", role: "important_page" },
    ]);
    expect(selected).toHaveLength(3);
  });

  it("prefers HTTP 200 important pages after the homepage and caps at three URLs", () => {
    const selected = selectInspectionUrls({
      pages: [
        {
          requestedUrl: "https://selcukdemirci.me/",
          finalUrl: "https://selcukdemirci.me/",
          statusCode: 200,
        },
        {
          requestedUrl: "https://selcukdemirci.me/about",
          finalUrl: "https://selcukdemirci.me/about",
          statusCode: 500,
        },
        {
          requestedUrl: "https://selcukdemirci.me/contact",
          finalUrl: "https://selcukdemirci.me/contact",
          statusCode: 200,
        },
        {
          requestedUrl: "https://selcukdemirci.me/company",
          finalUrl: "https://selcukdemirci.me/company",
          statusCode: 200,
        },
      ],
      website: SELCUK,
      propertyUri: "https://selcukdemirci.me/",
      limit: 3,
    });

    expect(selected.map((item) => item.url)).toEqual([
      "https://selcukdemirci.me/",
      "https://selcukdemirci.me/company",
      "https://selcukdemirci.me/contact",
    ]);
  });
});
