import { describe, expect, it } from "vitest";
import type { AnalysisFinding } from "./crawl-status";
import {
  detectHomepageBlockFromEvidence,
  detectHomepageBlockFromFindings,
  detectHomepageDiscovery,
  deriveSearchPresenceSignals,
  formatSearchPresenceCopy,
  isHomepageUrl,
  shouldLeadWithExistingJobs,
} from "./search-presence";
import type { CrawlEvidenceContext } from "@/lib/observations/types";

function finding(input: {
  ruleKey: string;
  pageUrl?: string | null;
  evidence?: Record<string, unknown>;
}): AnalysisFinding {
  return {
    id: input.ruleKey,
    ruleKey: input.ruleKey,
    category: "indexability",
    severity: "warning",
    title: input.ruleKey,
    description: input.ruleKey,
    pageUrl: input.pageUrl ?? null,
    evidence: input.evidence ?? {},
    priority: {
      level: "high",
      rank: 1,
      whyItMatters: "Why",
      recommendedAction: "Fix",
      verification: null,
    },
  };
}

function context(
  overrides: Partial<CrawlEvidenceContext> = {},
): CrawlEvidenceContext {
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

describe("isHomepageUrl", () => {
  it("treats www and apex roots as the same homepage", () => {
    expect(isHomepageUrl("https://foundfy.me/", "foundfy.me")).toBe(true);
    expect(isHomepageUrl("https://www.foundfy.me/", "foundfy.me")).toBe(true);
    expect(isHomepageUrl("https://www.foundfy.me/privacy", "foundfy.me")).toBe(
      false,
    );
  });
});

describe("formatSearchPresenceCopy", () => {
  it("states presence without claiming Google listing", () => {
    const copy = formatSearchPresenceCopy(null);

    expect(copy.brief).toContain("We could open your website.");
    expect(copy.brief).toContain(
      'We didn\'t find an obvious "don\'t crawl / don\'t list this" instruction on the main page.',
    );
    expect(copy.brief).not.toContain("That page is in your sitemap.");
    expect(copy.brief).not.toContain("linked from the pages we fetched");
    expect(copy.brief).toContain(
      "We cannot see whether Google has listed your site, or whether people find it when they search.",
    );
    expect(copy.brief).not.toMatch(/Google has (indexed|listed) your site\./i);
    expect(copy.title).toBe("We could open your website.");
  });

  it("mentions the sitemap only when that evidence is true", () => {
    expect(formatSearchPresenceCopy("sitemap").brief).toContain(
      "That page is in your sitemap.",
    );
    expect(formatSearchPresenceCopy("sitemap").brief).not.toContain(
      "linked from the pages we fetched",
    );
  });

  it("mentions internal links only when that evidence is true", () => {
    expect(formatSearchPresenceCopy("internal_links").brief).toContain(
      "That page is linked from the pages we fetched.",
    );
    expect(formatSearchPresenceCopy("internal_links").brief).not.toContain(
      "That page is in your sitemap.",
    );
  });
});

describe("homepage blocks", () => {
  it("does not treat a www redirect as a homepage block", () => {
    expect(
      detectHomepageBlockFromFindings([
        finding({
          ruleKey: "indexability.redirecting_url",
          pageUrl: "https://foundfy.me/",
          evidence: {
            requestedUrl: "https://foundfy.me/",
            finalUrl: "https://www.foundfy.me/",
          },
        }),
      ], "foundfy.me"),
    ).toBeNull();
  });

  it("detects homepage noindex from findings", () => {
    expect(
      detectHomepageBlockFromFindings([
        finding({
          ruleKey: "indexability.noindex",
          pageUrl: "https://www.foundfy.me/",
          evidence: { robotsMeta: "noindex" },
        }),
      ], "foundfy.me"),
    ).toBe("noindex");
  });

  it("detects homepage non_200 from crawled evidence", () => {
    expect(
      detectHomepageBlockFromEvidence(
        context({
          pages: [
            {
              id: "page-home",
              requestedUrl: "https://foundfy.me/",
              finalUrl: "https://foundfy.me/",
              statusCode: 403,
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
        }),
      ),
    ).toBe("non_200");
  });

  it("detects homepage robots disallow from the queue", () => {
    expect(
      detectHomepageBlockFromEvidence(
        context({
          queue: [
            {
              id: "q-1",
              url: "https://foundfy.me/",
              status: "skipped",
              skipReason: "robots_disallow",
            },
          ],
        }),
      ),
    ).toBe("robots_disallow");
  });
});

describe("homepage discovery", () => {
  it("prefers sitemap membership over internal links", () => {
    expect(
      detectHomepageDiscovery(
        context({
          pages: [
            {
              id: "page-home",
              requestedUrl: "https://foundfy.me/",
              finalUrl: "https://www.foundfy.me/",
              statusCode: 200,
              redirectChain: [],
              title: "Foundfy",
              metaDescription: null,
              canonical: null,
              robotsMeta: null,
              xRobotsTag: null,
              h1: [],
              internalLinkCount: 1,
            },
            {
              id: "page-about",
              requestedUrl: "https://www.foundfy.me/about",
              finalUrl: "https://www.foundfy.me/about",
              statusCode: 200,
              redirectChain: [],
              title: "About",
              metaDescription: null,
              canonical: null,
              robotsMeta: null,
              xRobotsTag: null,
              h1: [],
              internalLinkCount: 1,
            },
          ],
          links: [
            {
              id: "link-1",
              fromPageId: "page-about",
              toUrl: "https://www.foundfy.me/",
              linkType: "internal",
              anchorText: "Home",
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
      ),
    ).toBe("sitemap");
  });

  it("falls back to internal links when the homepage is not in the sitemap", () => {
    expect(
      detectHomepageDiscovery(
        context({
          hostname: "example.com",
          seedUrl: "https://example.com/",
          pages: [
            {
              id: "page-home",
              requestedUrl: "https://example.com/",
              finalUrl: "https://example.com/",
              statusCode: 200,
              redirectChain: [],
              title: "Home",
              metaDescription: null,
              canonical: null,
              robotsMeta: null,
              xRobotsTag: null,
              h1: [],
              internalLinkCount: 0,
            },
            {
              id: "page-about",
              requestedUrl: "https://example.com/about",
              finalUrl: "https://example.com/about",
              statusCode: 200,
              redirectChain: [],
              title: "About",
              metaDescription: null,
              canonical: null,
              robotsMeta: null,
              xRobotsTag: null,
              h1: [],
              internalLinkCount: 1,
            },
          ],
          links: [
            {
              id: "link-1",
              fromPageId: "page-about",
              toUrl: "https://example.com/",
              linkType: "internal",
              anchorText: "Home",
            },
          ],
        }),
      ),
    ).toBe("internal_links");
  });

  it("does not count a homepage linking to itself as inbound discovery", () => {
    expect(
      detectHomepageDiscovery(
        context({
          hostname: "example.com",
          seedUrl: "https://example.com/",
          pages: [
            {
              id: "page-home",
              requestedUrl: "https://example.com/",
              finalUrl: "https://example.com/",
              statusCode: 200,
              redirectChain: [],
              title: "Home",
              metaDescription: null,
              canonical: null,
              robotsMeta: null,
              xRobotsTag: null,
              h1: [],
              internalLinkCount: 1,
            },
          ],
          links: [
            {
              id: "link-self",
              fromPageId: "page-home",
              toUrl: "https://example.com/",
              linkType: "internal",
              anchorText: "Home",
            },
          ],
        }),
      ),
    ).toBeNull();
  });
});

describe("shouldLeadWithExistingJobs", () => {
  it("lets a real homepage block lead", () => {
    expect(
      shouldLeadWithExistingJobs({
        homepageBlock: "noindex",
        hasActionableHighlights: true,
      }),
    ).toBe(true);
  });

  it("shows the presence sentence when the crawl is clean and low-only", () => {
    expect(
      shouldLeadWithExistingJobs({
        homepageBlock: null,
        hasActionableHighlights: false,
      }),
    ).toBe(false);
  });
});

describe("deriveSearchPresenceSignals", () => {
  it("uses crawl evidence when it is available", () => {
    const signals = deriveSearchPresenceSignals(
      context({
        pages: [
          {
            id: "page-home",
            requestedUrl: "https://foundfy.me/",
            finalUrl: "https://www.foundfy.me/",
            statusCode: 200,
            redirectChain: [],
            title: "Foundfy",
            metaDescription: null,
            canonical: null,
            robotsMeta: "index,follow",
            xRobotsTag: null,
            h1: [],
            internalLinkCount: 0,
          },
        ],
        artifacts: [
          {
            id: "sitemap-1",
            artifactType: "sitemap_xml",
            url: "https://www.foundfy.me/sitemap.xml",
            statusCode: 200,
            parsed: { urls: ["https://www.foundfy.me/"] },
          },
        ],
      }),
      [
        finding({
          ruleKey: "indexability.redirecting_url",
          pageUrl: "https://foundfy.me/",
        }),
      ],
    );

    expect(signals.homepageBlock).toBeNull();
    expect(signals.homepageDiscovery).toBe("sitemap");
  });
});
