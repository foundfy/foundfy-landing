import { describe, expect, it } from "vitest";
import { getRuleRecommendation } from "@/lib/priorities/config/recommendations";
import { generatePriorityDrafts, buildPriorityContext } from "@/lib/priorities/engine";
import type { StoredObservation } from "@/lib/observations/types";
import {
  buildFindingRecommendation,
  buildGroupedBrokenLinkRecommendation,
} from "./build-recommendation";
import type { RecommendationInput } from "./types";

function input(
  ruleKey: string,
  evidence: Record<string, unknown>,
  pageUrl: string | null = null,
  priorityLevel: RecommendationInput["priorityLevel"] = "high",
): RecommendationInput {
  return { ruleKey, evidence, pageUrl, priorityLevel };
}

describe("buildFindingRecommendation", () => {
  it("produces identical text for the same evidence", () => {
    const args = input("page_fundamentals.missing_title", {
      requestedUrl: "https://example.com/about",
      finalUrl: "https://example.com/about",
      title: null,
    });

    const first = buildFindingRecommendation(args);
    const second = buildFindingRecommendation(args);

    expect(first).toEqual(second);
  });

  it("builds an evidence-aware broken internal link recommendation", () => {
    const recommendation = buildFindingRecommendation(
      input("internal_structure.broken_internal_link", {
        linkToUrl: "https://example.com/old-page",
        targetStatusCode: 404,
      }),
    );

    expect(recommendation.recommendedAction).toContain("/old-page");
    expect(recommendation.recommendedAction).toContain("404");
    expect(recommendation.verification).toContain("/old-page");
  });

  it("builds a missing title recommendation with the page path", () => {
    const recommendation = buildFindingRecommendation(
      input("page_fundamentals.missing_title", {
        requestedUrl: "https://example.com/about",
        finalUrl: "https://example.com/about",
        title: null,
      }),
    );

    expect(recommendation.recommendedAction).toContain("/about");
    expect(recommendation.verification).toContain("/about");
  });

  it("builds a missing meta description recommendation with the page path", () => {
    const recommendation = buildFindingRecommendation(
      input("page_fundamentals.missing_meta_description", {
        requestedUrl: "https://example.com/services",
        finalUrl: "https://example.com/services",
        metaDescription: null,
      }),
    );

    expect(recommendation.recommendedAction).toContain("/services");
  });

  it("builds a multiple H1 recommendation with the count", () => {
    const recommendation = buildFindingRecommendation(
      input("page_fundamentals.multiple_h1", {
        requestedUrl: "https://example.com/page",
        finalUrl: "https://example.com/page",
        h1: ["One", "Two"],
        h1Count: 2,
      }),
    );

    expect(recommendation.recommendedAction).toContain("2");
    expect(recommendation.recommendedAction).toContain("/page");
  });

  it("builds a canonical missing recommendation", () => {
    const recommendation = buildFindingRecommendation(
      input("indexability.canonical_missing", {
        requestedUrl: "https://example.com/page",
        finalUrl: "https://example.com/page",
        canonical: null,
      }),
    );

    expect(recommendation.recommendedAction).toContain("/page");
    expect(recommendation.verification).toContain("canonical");
  });

  it("builds a canonical points elsewhere recommendation", () => {
    const recommendation = buildFindingRecommendation(
      input("indexability.canonical_points_elsewhere", {
        requestedUrl: "https://example.com/page",
        finalUrl: "https://example.com/page",
        canonical: "https://example.com/preferred",
      }),
    );

    expect(recommendation.recommendedAction).toContain("/page");
    expect(recommendation.recommendedAction).toContain("/preferred");
  });

  it("builds a noindex recommendation", () => {
    const recommendation = buildFindingRecommendation(
      input("indexability.noindex", {
        requestedUrl: "https://example.com/private",
        finalUrl: "https://example.com/private",
        robotsMeta: "noindex",
      }),
    );

    expect(recommendation.recommendedAction).toContain("/private");
    expect(recommendation.recommendedAction).toContain("noindex");
  });

  it("uses neutral language for redirect LOW findings", () => {
    const recommendation = buildFindingRecommendation(
      input(
        "indexability.redirecting_url",
        {
          requestedUrl: "https://example.com/old",
          finalUrl: "https://example.com/new",
          redirectChain: [{ url: "https://example.com/old", statusCode: 301 }],
        },
        "https://example.com/old",
        "low",
      ),
    );

    expect(recommendation.whyItMatters).not.toMatch(/urgent|critical|immediately/i);
    expect(recommendation.recommendedAction).toContain("example.com/old");
    expect(recommendation.recommendedAction).toContain("example.com/new");
  });

  it("builds a non-200 page recommendation", () => {
    const recommendation = buildFindingRecommendation(
      input("indexability.non_200_page", {
        requestedUrl: "https://example.com/missing",
        finalUrl: "https://example.com/missing",
        statusCode: 404,
      }),
    );

    expect(recommendation.recommendedAction).toContain("/missing");
    expect(recommendation.recommendedAction).toContain("404");
  });

  it("builds duplicate title and meta recommendations with page counts", () => {
    const duplicateTitle = buildFindingRecommendation(
      input("page_fundamentals.duplicate_title", {
        title: "Shared title",
        duplicatePages: ["https://example.com/a", "https://example.com/b"],
        pageCount: 2,
      }),
    );
    const duplicateMeta = buildFindingRecommendation(
      input("page_fundamentals.duplicate_meta_description", {
        metaDescription: "Shared description",
        duplicatePages: ["https://example.com/a", "https://example.com/b"],
        pageCount: 2,
      }),
    );

    expect(duplicateTitle.recommendedAction).toContain("2 crawled pages");
    expect(duplicateMeta.recommendedAction).toContain("2 crawled pages");
  });

  it("builds zero internal links and orphan sitemap recommendations", () => {
    const zeroLinks = buildFindingRecommendation(
      input("internal_structure.zero_internal_links", {
        requestedUrl: "https://example.com/isolated",
        finalUrl: "https://example.com/isolated",
        internalLinkCount: 0,
      }),
    );
    const orphan = buildFindingRecommendation(
      input("internal_structure.orphan_sitemap_page", {
        sitemapUrl: "https://example.com/orphan",
        finalUrl: "https://example.com/orphan",
        incomingInternalLinksFound: 0,
      }),
    );

    expect(zeroLinks.recommendedAction).toContain("/isolated");
    expect(orphan.recommendedAction).toContain("/orphan");
  });

  it("builds robots and sitemap issue recommendations", () => {
    const robotsMissing = buildFindingRecommendation(
      input("site_discovery.robots_txt_missing", {
        robotsArtifactUrl: "https://example.com/robots.txt",
        statusCode: 404,
      }),
    );
    const sitemapMissing = buildFindingRecommendation(
      input("site_discovery.sitemap_missing", {
        sitemapAttempts: [{ url: "https://example.com/sitemap.xml", statusCode: 404 }],
      }),
    );
    const sitemapIssue = buildFindingRecommendation(
      input("site_discovery.sitemap_url_issue", {
        sitemapUrl: "https://example.com/broken-from-sitemap",
        pageStatusCode: 404,
      }),
    );
    const robotsBlocked = buildFindingRecommendation(
      input("indexability.robots_blocked_url", {
        queueUrl: "https://example.com/blocked",
        queueStatus: "skipped",
        skipReason: "robots_disallow",
      }),
    );

    expect(robotsMissing.recommendedAction).toBe(
      getRuleRecommendation("site_discovery.robots_txt_missing").recommendedAction,
    );
    expect(sitemapMissing.recommendedAction).toBe(
      getRuleRecommendation("site_discovery.sitemap_missing").recommendedAction,
    );
    expect(sitemapIssue.recommendedAction).toContain("/broken-from-sitemap");
    expect(sitemapIssue.recommendedAction).toContain("404");
    expect(robotsBlocked.recommendedAction).toContain("/blocked");
  });

  it("falls back to generic recommendation when evidence is missing", () => {
    const recommendation = buildFindingRecommendation(
      input("internal_structure.broken_internal_link", {}),
    );
    const template = getRuleRecommendation("internal_structure.broken_internal_link");

    expect(recommendation.recommendedAction).toBe(template.recommendedAction);
    expect(recommendation.whyItMatters).toBe(template.whyItMatters);
    expect(recommendation.recommendedAction).not.toContain("undefined");
  });

  it("falls back safely for malformed evidence", () => {
    const recommendation = buildFindingRecommendation(
      input("indexability.non_200_page", {
        statusCode: "404",
        requestedUrl: 123,
      }),
    );

    expect(recommendation.recommendedAction).toBe(
      getRuleRecommendation("indexability.non_200_page").recommendedAction,
    );
  });

  it("does not change priority scoring when recommendations are built", () => {
    const observations: StoredObservation[] = [
      {
        id: "obs-1",
        crawlRunId: "run-1",
        websiteId: "site-1",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        ruleKey: "page_fundamentals.missing_title",
        category: "page_fundamentals",
        severity: "error",
        title: "Missing title",
        description: "Description",
        pageUrl: "https://example.com/a",
        subjectKey: "page:a:missing_title",
        evidence: {
          requestedUrl: "https://example.com/a",
          finalUrl: "https://example.com/a",
          title: null,
        },
      },
      {
        id: "obs-2",
        crawlRunId: "run-1",
        websiteId: "site-1",
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        ruleKey: "indexability.redirecting_url",
        category: "indexability",
        severity: "info",
        title: "Redirect",
        description: "Description",
        pageUrl: "https://example.com/old",
        subjectKey: "page:old:redirect",
        evidence: {
          requestedUrl: "https://example.com/old",
          finalUrl: "https://example.com/new",
          redirectChain: [],
        },
      },
    ];

    const context = buildPriorityContext({
      crawlRunId: "run-1",
      websiteId: "site-1",
      totalPagesCrawled: 10,
      observations,
    });

    const drafts = generatePriorityDrafts({ observations, context });
    buildFindingRecommendation({
      ruleKey: observations[0].ruleKey,
      pageUrl: observations[0].pageUrl ?? null,
      evidence: observations[0].evidence,
      priorityLevel: drafts[0].priorityLevel,
    });

    expect(drafts.map((draft) => draft.priorityLevel)).toEqual(["high", "low"]);
    expect(drafts[0].rank).toBe(1);
    expect(drafts[1].rank).toBe(2);
  });
});

describe("buildGroupedBrokenLinkRecommendation", () => {
  it("uses unique affected page count rather than raw observation count", () => {
    const recommendation = buildGroupedBrokenLinkRecommendation(
      input("internal_structure.broken_internal_link", {
        linkToUrl: "https://example.com/example",
        targetStatusCode: 404,
      }),
      2,
    );

    expect(recommendation.recommendedAction).toContain("2 crawled pages");
    expect(recommendation.recommendedAction).not.toContain("4 crawled pages");
    expect(recommendation.recommendedAction).toContain("/example");
    expect(recommendation.recommendedAction).toContain("404");
  });
});
