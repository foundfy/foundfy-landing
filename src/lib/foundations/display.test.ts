import { describe, expect, it } from "vitest";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import type { CrawlEvidenceContext } from "@/lib/observations/types";
import {
  FOUNDATION_CHECK_LABELS,
  FOUNDATION_STATUS_LABELS,
  FOUNDATIONS_HEADING,
  buildTechnicalFoundationsView,
} from "./display";
import { evaluateCrawlFoundations } from "./evaluate";

const SELCUK_URLS = [
  "https://selcukdemirci.me/",
  "https://selcukdemirci.me/about",
  "https://selcukdemirci.me/contact",
] as const;

function finding(ruleKey: string, pageUrl: string): AnalysisFinding {
  return {
    id: `${ruleKey}:${pageUrl}`,
    ruleKey,
    category: "page_fundamentals",
    severity: "warning",
    title: ruleKey,
    description: ruleKey,
    pageUrl,
    evidence: {},
    priority: null,
  };
}

function selcukContext(): CrawlEvidenceContext {
  return {
    crawlRunId: "selcuk-run",
    websiteId: "selcuk-site",
    hostname: "selcukdemirci.me",
    seedUrl: "https://selcukdemirci.me/",
    pages: SELCUK_URLS.map((url, index) => ({
      id: `page-${index}`,
      requestedUrl: url,
      finalUrl: url,
      statusCode: 200,
      redirectChain: [],
      title: url,
      metaDescription: index === 0 ? "Home" : null,
      canonical: url,
      robotsMeta: null,
      xRobotsTag: null,
      h1: ["Heading"],
      internalLinkCount: 2,
    })),
    links: [],
    queue: SELCUK_URLS.map((url, index) => ({
      id: `queue-${index}`,
      url,
      status: "completed",
      skipReason: null,
    })),
    artifacts: [
      {
        id: "robots",
        artifactType: "robots_txt",
        url: "https://selcukdemirci.me/robots.txt",
        statusCode: 200,
        parsed: { allow: ["/"], disallow: [], sitemaps: [] },
      },
      {
        id: "sitemap",
        artifactType: "sitemap_xml",
        url: "https://selcukdemirci.me/sitemap.xml",
        statusCode: 200,
        parsed: { urls: [...SELCUK_URLS] },
      },
    ],
  };
}

function serializedView(
  crawl = evaluateCrawlFoundations({
    context: selcukContext(),
    findings: [
      finding("page_fundamentals.missing_meta_description", "https://selcukdemirci.me/about"),
    ],
  }),
  google: Parameters<typeof buildTechnicalFoundationsView>[1] = {
    kind: "empty",
    windowDays: 28,
  },
) {
  return JSON.stringify(buildTechnicalFoundationsView(crawl, google));
}

describe("buildTechnicalFoundationsView — selcukdemirci.me", () => {
  it("renders the owner-facing acceptance case without a false Google indexed claim", () => {
    const crawl = evaluateCrawlFoundations({
      context: selcukContext(),
      findings: [
        finding("page_fundamentals.missing_meta_description", "https://selcukdemirci.me/about"),
        finding("page_fundamentals.missing_meta_description", "https://selcukdemirci.me/contact"),
      ],
    });
    const view = buildTechnicalFoundationsView(crawl, { kind: "empty", windowDays: 28 });

    expect(view.heading).toBe(FOUNDATIONS_HEADING);
    expect(view.intro).toMatch(/not a Google ranking report/i);
    expect(view.sitemapUrlCount).toBe(3);
    expect(view.sitemapUrls).toEqual([...SELCUK_URLS]);
    expect(view.checks.map((check) => check.id)).toEqual([
      "important_pages",
      "crawlability",
      "indexability",
      "sitemap",
      "google_performance",
      "google_indexing",
    ]);

    const byId = Object.fromEntries(view.checks.map((check) => [check.id, check]));
    expect(byId.important_pages?.status).toBe("verified");
    expect(byId.crawlability?.status).toBe("verified");
    expect(byId.indexability?.status).toBe("verified");
    expect(byId.sitemap?.status).toBe("verified");
    expect(byId.google_performance?.status).toBe("data_unavailable");
    expect(byId.google_indexing?.status).toBe("not_checked");
    expect(FOUNDATION_STATUS_LABELS[byId.google_indexing!.status]).toBe("Not checked");
    expect(FOUNDATION_CHECK_LABELS.google_indexing).toBe("Google indexing");
    expect(view.nextStep.code).toBe("wait_for_google_discovery");
    expect(view.nextStep.message).toMatch(/not asking you to rewrite titles or submit changes yet/i);
    expect(view.nextStep.message).not.toMatch(/you should rewrite|submit the sitemap|request indexing/i);
  });

  it("never claims Google has indexed the site from crawl, sitemap, or analytics", () => {
    const empty = serializedView();
    const reported = serializedView(
      evaluateCrawlFoundations({ context: selcukContext(), findings: [] }),
      { kind: "reported", windowDays: 28, queriesReported: 12 },
    );

    for (const blob of [empty, reported]) {
      expect(blob).not.toMatch(/Google indexed/i);
      expect(blob).not.toMatch(/is indexed by Google/i);
      expect(blob).not.toMatch(/pages are indexed/i);
      expect(blob).not.toMatch(/Google has listed (your site|these pages)\./i);
      expect(blob).toMatch(/has not checked whether Google has indexed/i);
    }

    const reportedView = buildTechnicalFoundationsView(
      evaluateCrawlFoundations({ context: selcukContext(), findings: [] }),
      { kind: "reported", windowDays: 28, queriesReported: 12 },
    );
    const indexing = reportedView.checks.find((check) => check.id === "google_indexing");
    expect(indexing?.status).toBe("not_checked");
    expect(indexing?.summary).toMatch(/has not checked whether Google has indexed/i);
  });

  it("does not recommend title or content rewrites for an empty GSC new site", () => {
    const view = buildTechnicalFoundationsView(
      evaluateCrawlFoundations({ context: selcukContext(), findings: [] }),
      { kind: "empty", windowDays: 28 },
    );
    expect(view.nextStep.message).toMatch(/not asking you to rewrite titles or submit changes yet/i);
    expect(view.nextStep.message).not.toMatch(
      /you should rewrite|optimize title|add a meta description|submit the sitemap/i,
    );
    expect(view.nextStep.message).toMatch(/let Google discover/i);
  });

  it("keeps completed empty GSC copy distinct from unauthorized Google data", () => {
    const crawl = evaluateCrawlFoundations({ context: selcukContext(), findings: [] });
    const empty = buildTechnicalFoundationsView(crawl, { kind: "empty", windowDays: 28 });
    const noSession = buildTechnicalFoundationsView(crawl, { kind: "no_session" });
    const emptyPerformance = empty.checks.find((check) => check.id === "google_performance");
    const noSessionPerformance = noSession.checks.find((check) => check.id === "google_performance");

    expect(emptyPerformance?.summary).not.toEqual(noSessionPerformance?.summary);
    expect(empty.nextStep.code).toBe("wait_for_google_discovery");
    expect(noSession.nextStep.code).toBe("connect_google_for_performance");
    expect(empty.checks.find((check) => check.id === "google_indexing")?.status).toBe(
      "not_checked",
    );
    expect(noSession.checks.find((check) => check.id === "google_indexing")?.status).toBe(
      "not_checked",
    );
  });
});
