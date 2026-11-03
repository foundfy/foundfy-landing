import { describe, expect, it } from "vitest";
import {
  interpretIndexStatus,
  interpretIndexVerdict,
  interpretSitemapsList,
} from "./indexing-interpret";

const INSPECTED_AT = "2026-11-02T12:00:00.000Z";

describe("URL Inspection interpretation", () => {
  it("A. treats an explicit PASS verdict as indexed", () => {
    expect(
      interpretIndexVerdict({
        verdict: "PASS",
        coverageState: "Submitted and indexed",
        indexingState: "INDEXING_ALLOWED",
      }),
    ).toBe("indexed");
  });

  it("B. treats a NEUTRAL / excluded URL unknown to Google as not indexed", () => {
    expect(
      interpretIndexVerdict({
        verdict: "NEUTRAL",
        coverageState: "URL is unknown to Google",
      }),
    ).toBe("not_indexed");
  });

  it("C. treats a NEUTRAL crawled-but-not-indexed result as not indexed", () => {
    expect(
      interpretIndexVerdict({
        verdict: "NEUTRAL",
        coverageState: "Crawled - currently not indexed",
      }),
    ).toBe("not_indexed");
  });

  it("D. treats a Google-reported noindex exclusion as not indexed", () => {
    const evidence = interpretIndexStatus({
      url: "https://selcukdemirci.me/",
      role: "homepage",
      inspectedAt: INSPECTED_AT,
      status: {
        verdict: "NEUTRAL",
        coverageState: "Excluded by ‘noindex’ tag",
        indexingState: "BLOCKED_BY_META_TAG",
      },
    });
    expect(evidence.verdict).toBe("not_indexed");
    expect(evidence.reason).toMatch(/noindex/i);
    expect(evidence.indexingState).toBe("BLOCKED_BY_META_TAG");
  });

  it("E. flags a Google-selected canonical that differs from the page canonical", () => {
    const evidence = interpretIndexStatus({
      url: "https://selcukdemirci.me/about",
      role: "important_page",
      inspectedAt: INSPECTED_AT,
      status: {
        verdict: "PASS",
        coverageState: "Indexed, though blocked by robots.txt",
        userCanonical: "https://selcukdemirci.me/about",
        googleCanonical: "https://selcukdemirci.me/",
      },
    });
    expect(evidence.verdict).toBe("indexed");
    expect(evidence.canonicalMismatch).toBe(true);
  });

  it("F. preserves missing optional API fields as unknown rather than indexed", () => {
    const evidence = interpretIndexStatus({
      url: "https://selcukdemirci.me/contact",
      role: "important_page",
      inspectedAt: INSPECTED_AT,
      status: {},
    });
    expect(evidence.verdict).toBe("unknown");
    expect(evidence.coverageState).toBeNull();
    expect(evidence.lastCrawlTime).toBeNull();
    expect(evidence.userCanonical).toBeNull();
    expect(evidence.googleCanonical).toBeNull();
    expect(evidence.referringUrls).toEqual([]);
    expect(evidence.sitemaps).toEqual([]);
  });

  it("never treats INDEXING_ALLOWED as proof that a URL is indexed", () => {
    expect(
      interpretIndexVerdict({
        indexingState: "INDEXING_ALLOWED",
      }),
    ).toBe("unknown");
    expect(
      interpretIndexStatus({
        url: "https://selcukdemirci.me/",
        role: "homepage",
        inspectedAt: INSPECTED_AT,
        status: { indexingState: "INDEXING_ALLOWED" },
      }).verdict,
    ).toBe("unknown");
  });

  it("does not classify PARTIAL, FAIL, or coverage substrings as indexed", () => {
    expect(interpretIndexVerdict({ verdict: "PARTIAL" })).toBe("unknown");
    expect(
      interpretIndexVerdict({
        verdict: "PARTIAL",
        coverageState: "Submitted and indexed",
      }),
    ).toBe("unknown");
    expect(interpretIndexVerdict({ verdict: "FAIL" })).toBe("unknown");
    expect(
      interpretIndexVerdict({
        verdict: "FAIL",
        coverageState: "URL is unknown to Google",
      }),
    ).toBe("unknown");
    expect(
      interpretIndexVerdict({
        coverageState: "Submitted and indexed",
      }),
    ).toBe("unknown");
    expect(
      interpretIndexVerdict({
        coverageState: "Crawled - currently not indexed",
      }),
    ).toBe("unknown");
  });
});

describe("Search Console sitemap observation", () => {
  it("G. interprets a processed listed sitemap without using contents.indexed", () => {
    const observation = interpretSitemapsList({
      crawledSitemapUrls: ["https://selcukdemirci.me/sitemap.xml"],
      sitemaps: [
        {
          path: "https://selcukdemirci.me/sitemap.xml",
          lastSubmitted: "2026-10-01T00:00:00.000Z",
          lastDownloaded: "2026-10-02T00:00:00.000Z",
          isPending: false,
          errors: 0,
          warnings: 0,
          contents: [{ type: "web", submitted: 3, indexed: 99 }],
        },
      ],
    });

    expect(observation.interpretation).toBe("listed_and_processed");
    expect(observation.listedInSearchConsole).toBe(true);
    expect(observation.sitemaps[0]?.submittedUrlCount).toBe(3);
    expect(JSON.stringify(observation)).not.toMatch(/99/);
  });

  it("H. interprets pending processing or errors as a distinct listed state", () => {
    expect(
      interpretSitemapsList({
        crawledSitemapUrls: [],
        sitemaps: [
          {
            path: "https://selcukdemirci.me/sitemap.xml",
            isPending: true,
            errors: 2,
            contents: [{ type: "web", submitted: 3 }],
          },
        ],
      }).interpretation,
    ).toBe("listed_pending_or_errors");
  });

  it("I. does not treat a crawler-found sitemap as listed in Search Console", () => {
    const observation = interpretSitemapsList({
      crawledSitemapUrls: ["https://selcukdemirci.me/sitemap.xml"],
      sitemaps: [],
    });
    expect(observation.interpretation).toBe("none_listed");
    expect(observation.listedInSearchConsole).toBe(false);
    expect(observation.crawledSitemapUrls).toEqual(["https://selcukdemirci.me/sitemap.xml"]);
  });
});
