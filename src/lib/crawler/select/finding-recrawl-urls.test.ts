import { describe, expect, it } from "vitest";
import type { StoredObservation } from "@/lib/observations/types";
import { MAX_PAGES_PER_CRAWL } from "@/lib/crawler/types";
import {
  extractFindingRecrawlUrls,
  selectFindingRecrawlUrls,
} from "./finding-recrawl-urls";

function observation(
  overrides: Partial<StoredObservation> &
    Pick<StoredObservation, "ruleKey">,
): StoredObservation {
  return {
    id: "obs-1",
    crawlRunId: "run-1",
    websiteId: "website-1",
    status: "active",
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
    category: "page_fundamentals",
    severity: "warning",
    title: "Finding",
    description: "Finding",
    subjectKey: "subject",
    evidence: {},
    pageUrl: null,
    ...overrides,
  };
}

describe("extractFindingRecrawlUrls", () => {
  it("collects page and evidence URLs from page-scoped findings", () => {
    const urls = extractFindingRecrawlUrls([
      observation({
        ruleKey: "page_fundamentals.duplicate_title",
        pageUrl: "https://example.com/about",
        evidence: {
          finalUrl: "https://example.com/about",
          requestedUrl: "https://example.com/about",
        },
      }),
      observation({
        ruleKey: "indexability.noindex",
        pageUrl: "https://example.com/hidden",
      }),
    ]);

    expect(urls).toEqual([
      "https://example.com/about",
      "https://example.com/about",
      "https://example.com/about",
      "https://example.com/hidden",
    ]);
  });

  it("includes broken-link source and target plus robots queue URLs", () => {
    const urls = extractFindingRecrawlUrls([
      observation({
        ruleKey: "internal_structure.broken_internal_link",
        pageUrl: "https://example.com/shop",
        evidence: { linkToUrl: "https://example.com/missing" },
      }),
      observation({
        ruleKey: "indexability.robots_blocked_url",
        evidence: { queueUrl: "https://example.com/private" },
      }),
    ]);

    expect(urls).toEqual([
      "https://example.com/missing",
      "https://example.com/shop",
      "https://example.com/private",
    ]);
  });

  it("skips site-wide rules that do not name a page", () => {
    expect(
      extractFindingRecrawlUrls([
        observation({
          ruleKey: "site_discovery.robots_txt_missing",
          pageUrl: "https://example.com/",
        }),
        observation({
          ruleKey: "site_discovery.sitemap_missing",
        }),
      ]),
    ).toEqual([]);
  });
});

describe("selectFindingRecrawlUrls", () => {
  it("prioritizes unique same-site finding URLs and excludes the seed", () => {
    const selected = selectFindingRecrawlUrls(
      [
        "https://example.com/",
        "https://example.com/about",
        "https://www.example.com/about",
        "https://other.test/about",
        "https://example.com/services",
      ],
      {
        seedUrl: "https://example.com/",
        hostname: "example.com",
        origin: "https://example.com",
      },
    );

    expect(selected).toEqual([
      "https://example.com/about",
      "https://example.com/services",
    ]);
  });

  it("drops robots/sitemap artifacts and stays within the remaining 10-page budget", () => {
    const extras = Array.from({ length: 12 }, (_, index) => {
      return `https://example.com/page-${index + 1}`;
    });

    const selected = selectFindingRecrawlUrls(
      ["https://example.com/robots.txt", "https://example.com/sitemap.xml", ...extras],
      {
        seedUrl: "https://example.com/",
        hostname: "example.com",
      },
    );

    expect(selected).toHaveLength(MAX_PAGES_PER_CRAWL - 1);
    expect(selected[0]).toBe("https://example.com/page-1");
    expect(selected.at(-1)).toBe("https://example.com/page-9");
    expect(selected).not.toContain("https://example.com/robots.txt");
    expect(selected).not.toContain("https://example.com/sitemap.xml");
  });
});
