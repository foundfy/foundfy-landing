import { describe, expect, it } from "vitest";
import { generateObservationDrafts } from "./engine";
import type { CrawlEvidenceContext } from "./types";

function buildContext(overrides: Partial<CrawlEvidenceContext> = {}): CrawlEvidenceContext {
  return {
    crawlRunId: "run-1",
    websiteId: "site-1",
    hostname: "foundfy.me",
    seedUrl: "https://foundfy.me/",
    pages: [],
    links: [],
    queue: [],
    artifacts: [],
    ...overrides,
  };
}

describe("generateObservationDrafts", () => {
  it("detects redirecting URLs and missing canonical on indexable pages", () => {
    const observations = generateObservationDrafts(
      buildContext({
        pages: [
          {
            id: "page-1",
            requestedUrl: "https://foundfy.me/",
            finalUrl: "https://www.foundfy.me/",
            statusCode: 200,
            redirectChain: [{ url: "https://foundfy.me/", statusCode: 308 }],
            title: "Foundfy | Be found wherever people search.",
            metaDescription: "Search visibility for startups.",
            canonical: null,
            robotsMeta: "index,follow",
            xRobotsTag: null,
            h1: ["Understand visibility"],
            internalLinkCount: 3,
          },
        ],
        artifacts: [
          {
            id: "robots-1",
            artifactType: "robots_txt",
            url: "https://foundfy.me/robots.txt",
            statusCode: 200,
            parsed: { sitemaps: ["https://www.foundfy.me/sitemap.xml"], allow: ["/"], disallow: [] },
          },
          {
            id: "sitemap-1",
            artifactType: "sitemap_xml",
            url: "https://www.foundfy.me/sitemap.xml",
            statusCode: 200,
            parsed: { urls: ["https://www.foundfy.me/"], isIndex: false },
          },
        ],
      }),
    );

    expect(observations.some((item) => item.ruleKey === "indexability.redirecting_url")).toBe(
      true,
    );
    expect(observations.some((item) => item.ruleKey === "indexability.canonical_missing")).toBe(
      true,
    );
    expect(observations.some((item) => item.ruleKey === "site_discovery.robots_txt_missing")).toBe(
      false,
    );
  });

  it("detects duplicate titles across pages", () => {
    const observations = generateObservationDrafts(
      buildContext({
        pages: [
          {
            id: "page-1",
            requestedUrl: "https://foundfy.me/a",
            finalUrl: "https://foundfy.me/a",
            statusCode: 200,
            redirectChain: [],
            title: "Same title",
            metaDescription: "One",
            canonical: "https://foundfy.me/a",
            robotsMeta: null,
            xRobotsTag: null,
            h1: ["Heading"],
            internalLinkCount: 1,
          },
          {
            id: "page-2",
            requestedUrl: "https://foundfy.me/b",
            finalUrl: "https://foundfy.me/b",
            statusCode: 200,
            redirectChain: [],
            title: "Same title",
            metaDescription: "Two",
            canonical: "https://foundfy.me/b",
            robotsMeta: null,
            xRobotsTag: null,
            h1: ["Heading"],
            internalLinkCount: 1,
          },
        ],
      }),
    );

    const duplicateTitleObservations = observations.filter(
      (item) => item.ruleKey === "page_fundamentals.duplicate_title",
    );

    expect(duplicateTitleObservations).toHaveLength(2);
    expect(duplicateTitleObservations[0]?.evidence.pageCount).toBe(2);
  });

  it("detects broken internal links only when target was crawled with non-200", () => {
    const observations = generateObservationDrafts(
      buildContext({
        pages: [
          {
            id: "page-home",
            requestedUrl: "https://foundfy.me/",
            finalUrl: "https://foundfy.me/",
            statusCode: 200,
            redirectChain: [],
            title: "Home",
            metaDescription: "Home desc",
            canonical: "https://foundfy.me/",
            robotsMeta: null,
            xRobotsTag: null,
            h1: ["Home"],
            internalLinkCount: 1,
          },
          {
            id: "page-broken",
            requestedUrl: "https://foundfy.me/missing",
            finalUrl: "https://foundfy.me/missing",
            statusCode: 404,
            redirectChain: [],
            title: null,
            metaDescription: null,
            canonical: null,
            robotsMeta: null,
            xRobotsTag: null,
            h1: [],
            internalLinkCount: 0,
          },
        ],
        links: [
          {
            id: "link-1",
            fromPageId: "page-home",
            toUrl: "https://foundfy.me/missing",
            linkType: "internal",
            anchorText: "Missing page",
          },
          {
            id: "link-2",
            fromPageId: "page-home",
            toUrl: "https://foundfy.me/uncrawled",
            linkType: "internal",
            anchorText: "Uncrawled page",
          },
        ],
      }),
    );

    expect(
      observations.some((item) => item.ruleKey === "internal_structure.broken_internal_link"),
    ).toBe(true);
    expect(
      observations.filter((item) => item.ruleKey === "internal_structure.broken_internal_link"),
    ).toHaveLength(1);
  });

  it("does not flag sitemap URLs skipped as duplicate final URLs", () => {
    const observations = generateObservationDrafts(
      buildContext({
        pages: [
          {
            id: "page-1",
            requestedUrl: "https://foundfy.me/",
            finalUrl: "https://www.foundfy.me/",
            statusCode: 200,
            redirectChain: [{ url: "https://foundfy.me/", statusCode: 308 }],
            title: "Foundfy",
            metaDescription: "Desc",
            canonical: "https://www.foundfy.me/",
            robotsMeta: null,
            xRobotsTag: null,
            h1: ["Heading"],
            internalLinkCount: 3,
          },
        ],
        queue: [
          {
            id: "queue-1",
            url: "https://www.foundfy.me/",
            status: "skipped",
            skipReason: "duplicate_final_url",
          },
        ],
        artifacts: [
          {
            id: "sitemap-1",
            artifactType: "sitemap_xml",
            url: "https://www.foundfy.me/sitemap.xml",
            statusCode: 200,
            parsed: { urls: ["https://www.foundfy.me/"], isIndex: false },
          },
        ],
      }),
    );

    expect(observations.some((item) => item.ruleKey === "site_discovery.sitemap_url_issue")).toBe(
      false,
    );
  });
});
