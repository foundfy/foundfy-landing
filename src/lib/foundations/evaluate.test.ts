import { describe, expect, it } from "vitest";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import type {
  CrawlEvidenceContext,
  CrawlPageEvidence,
} from "@/lib/observations/types";
import type { GoogleIndexingEvidenceInput, GoogleIndexingUrlEvidence } from "./types";
import {
  FOUNDATION_SITEMAP_PREVIEW_LIMIT,
  evaluateCrawlFoundations,
  evaluateGooglePerformance,
  googleIndexingCheck,
  interpretFoundationNextStep,
  selectGoogleEvidenceForWebsite,
  visibleGoogleEvidenceForWebsite,
} from "./evaluate";

const SELCUK_URLS = [
  "https://selcukdemirci.me/",
  "https://selcukdemirci.me/about",
  "https://selcukdemirci.me/contact",
] as const;

function finding(input: {
  ruleKey: string;
  pageUrl?: string | null;
  evidence?: Record<string, unknown>;
}): AnalysisFinding {
  return {
    id: input.ruleKey,
    ruleKey: input.ruleKey,
    category: input.ruleKey.split(".")[0] ?? "indexability",
    severity: "warning",
    title: input.ruleKey,
    description: input.ruleKey,
    pageUrl: input.pageUrl ?? null,
    evidence: input.evidence ?? {},
    priority: {
      level: "medium",
      rank: 10,
      whyItMatters: "Why",
      recommendedAction: "Fix",
      verification: null,
    },
  };
}

function page(
  url: string,
  overrides: Partial<CrawlPageEvidence> = {},
): CrawlPageEvidence {
  return {
    id: url,
    requestedUrl: url,
    finalUrl: url,
    statusCode: 200,
    redirectChain: [],
    title: url,
    metaDescription: "Description",
    canonical: url,
    robotsMeta: null,
    xRobotsTag: null,
    h1: ["Heading"],
    internalLinkCount: 1,
    ...overrides,
  };
}

function selcukContext(
  overrides: Partial<CrawlEvidenceContext> = {},
): CrawlEvidenceContext {
  return {
    crawlRunId: "selcuk-run",
    websiteId: "selcuk-site",
    hostname: "selcukdemirci.me",
    seedUrl: "https://selcukdemirci.me/",
    pages: SELCUK_URLS.map((url, index) =>
      page(url, {
        id: `page-${index}`,
        title: index === 0 ? "Selcuk Demirci" : index === 1 ? "About" : "Contact",
        metaDescription: index === 0 ? "Home description" : null,
      }),
    ),
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
        parsed: {
          allow: ["/"],
          disallow: [],
          sitemaps: ["https://selcukdemirci.me/sitemap.xml"],
        },
      },
      {
        id: "sitemap",
        artifactType: "sitemap_xml",
        url: "https://selcukdemirci.me/sitemap.xml",
        statusCode: 200,
        parsed: { urls: [...SELCUK_URLS] },
      },
    ],
    ...overrides,
  };
}

describe("evaluateCrawlFoundations — selcukdemirci.me", () => {
  it("treats the 3-page sample as verified crawl foundations without claiming site-wide health", () => {
    const assessment = evaluateCrawlFoundations({
      context: selcukContext(),
      findings: [
        finding({
          ruleKey: "page_fundamentals.missing_meta_description",
          pageUrl: "https://selcukdemirci.me/about",
        }),
        finding({
          ruleKey: "page_fundamentals.missing_meta_description",
          pageUrl: "https://selcukdemirci.me/contact",
        }),
      ],
    });

    expect(assessment.pagesFetched).toBe(3);
    expect(assessment.sampleLimited).toBe(false);
    expect(assessment.sitemapUrlCount).toBe(3);
    expect(assessment.sitemapUrls).toEqual([...SELCUK_URLS]);
    expect(assessment.homepageBlock).toBeNull();
    expect(assessment.checks.importantPages.status).toBe("verified");
    expect(assessment.checks.crawlability.status).toBe("verified");
    expect(assessment.checks.indexability.status).toBe("verified");
    expect(assessment.checks.sitemap.status).toBe("verified");
    expect(assessment.checks.importantPages.summary).toContain("this scan");
    expect(assessment.checks.importantPages.detail).not.toMatch(/whole website is healthy/i);
    expect(assessment.checks.indexability.detail).toMatch(/not a Google indexing check/i);
    expect(assessment.checks.sitemap.detail).toMatch(/does not mean Google has indexed/i);
    expect(assessment.hasImportantIndexabilityBlock).toBe(false);
  });
});

describe("evaluateCrawlFoundations — adversarial cases", () => {
  it("does not treat absence of findings as a verified full-site result when no pages were fetched", () => {
    const assessment = evaluateCrawlFoundations({
      context: selcukContext({
        pages: [],
        queue: [
          {
            id: "queue-home",
            url: "https://selcukdemirci.me/",
            status: "failed",
            skipReason: null,
          },
        ],
      }),
      findings: [],
    });

    expect(assessment.checks.importantPages.status).toBe("needs_attention");
    expect(assessment.checks.importantPages.summary).toContain("did not fetch");
  });

  it("marks a partial crawl as sample-limited even when the homepage is verified", () => {
    const sitemapUrls = [
      ...SELCUK_URLS,
      "https://selcukdemirci.me/blog",
      "https://selcukdemirci.me/work",
    ];
    const assessment = evaluateCrawlFoundations({
      context: selcukContext({
        queue: sitemapUrls.map((url, index) => ({
          id: `queue-${index}`,
          url,
          status: index < 3 ? "completed" : "pending",
          skipReason: null,
        })),
        artifacts: [
          selcukContext().artifacts[0]!,
          {
            id: "sitemap",
            artifactType: "sitemap_xml",
            url: "https://selcukdemirci.me/sitemap.xml",
            statusCode: 200,
            parsed: { urls: sitemapUrls },
          },
        ],
      }),
      findings: [],
    });

    expect(assessment.sampleLimited).toBe(true);
    expect(assessment.pagesFetched).toBe(3);
    expect(assessment.discoveredUrlCount).toBe(5);
    expect(assessment.checks.importantPages.status).toBe("verified");
    expect(assessment.checks.importantPages.detail).toMatch(/sample/i);
  });

  it("previews a bounded sitemap list instead of dumping every listed URL", () => {
    const manyUrls = Array.from(
      { length: FOUNDATION_SITEMAP_PREVIEW_LIMIT + 5 },
      (_, index) => `https://selcukdemirci.me/p/${index}`,
    );
    const assessment = evaluateCrawlFoundations({
      context: selcukContext({
        artifacts: [
          selcukContext().artifacts[0]!,
          {
            id: "sitemap",
            artifactType: "sitemap_xml",
            url: "https://selcukdemirci.me/sitemap.xml",
            statusCode: 200,
            parsed: { urls: manyUrls },
          },
        ],
      }),
      findings: [],
    });

    expect(assessment.sitemapUrlCount).toBe(manyUrls.length);
    expect(assessment.sitemapUrls).toHaveLength(FOUNDATION_SITEMAP_PREVIEW_LIMIT);
    expect(assessment.checks.sitemap.summary).toContain(`${manyUrls.length} URLs`);
  });

  it("treats a missing sitemap artifact as data unavailable, not a panic blocker", () => {
    const assessment = evaluateCrawlFoundations({
      context: selcukContext({
        artifacts: [selcukContext().artifacts[0]!],
      }),
      findings: [
        finding({ ruleKey: "site_discovery.sitemap_missing" }),
      ],
    });

    expect(assessment.checks.sitemap.status).toBe("data_unavailable");
    expect(assessment.checks.sitemap.summary).toMatch(/not always an error/i);
    expect(assessment.hasSitemapUrlIssues).toBe(false);
    expect(
      interpretFoundationNextStep(assessment, { kind: "empty", windowDays: 28 }).code,
    ).toBe("wait_for_google_discovery");
  });

  it("keeps crawlability verified when only User-agent: * rules were parsed", () => {
    const assessment = evaluateCrawlFoundations({
      context: selcukContext({
        artifacts: [
          {
            id: "robots",
            artifactType: "robots_txt",
            url: "https://selcukdemirci.me/robots.txt",
            statusCode: 200,
            parsed: { allow: [], disallow: [], sitemaps: [] },
          },
          selcukContext().artifacts[1]!,
        ],
      }),
      findings: [],
    });

    expect(assessment.checks.crawlability.status).toBe("verified");
    expect(assessment.checks.crawlability.detail).toMatch(/User-agent: \*/);
    expect(assessment.checks.crawlability.detail).toMatch(/not Googlebot-specific/);
  });

  it("leads with homepage noindex instead of missing canonical notes", () => {
    const assessment = evaluateCrawlFoundations({
      context: selcukContext({
        pages: [
          page("https://selcukdemirci.me/", {
            id: "page-home",
            robotsMeta: "noindex,follow",
            canonical: null,
          }),
          page("https://selcukdemirci.me/about", { id: "page-about", canonical: null }),
          page("https://selcukdemirci.me/contact", { id: "page-contact" }),
        ],
      }),
      findings: [
        finding({
          ruleKey: "indexability.noindex",
          pageUrl: "https://selcukdemirci.me/",
        }),
        finding({
          ruleKey: "indexability.canonical_missing",
          pageUrl: "https://selcukdemirci.me/",
        }),
      ],
    });

    expect(assessment.homepageBlock).toBe("noindex");
    expect(assessment.checks.indexability.status).toBe("needs_attention");
    expect(assessment.checks.indexability.summary).toMatch(/noindex/i);
    expect(interpretFoundationNextStep(assessment, { kind: "empty", windowDays: 28 }).code).toBe(
      "review_homepage_block",
    );
  });

  it("keeps canonical-missing as a note when the homepage is otherwise fetchable", () => {
    const assessment = evaluateCrawlFoundations({
      context: selcukContext(),
      findings: [
        finding({
          ruleKey: "indexability.canonical_missing",
          pageUrl: "https://selcukdemirci.me/about",
        }),
      ],
    });

    expect(assessment.checks.indexability.status).toBe("verified");
    expect(assessment.checks.indexability.detail).toMatch(/canonical tag/i);
    expect(assessment.hasImportantIndexabilityBlock).toBe(false);
    expect(
      interpretFoundationNextStep(assessment, { kind: "empty", windowDays: 28 }).code,
    ).toBe("wait_for_google_discovery");
  });

  it("treats an important-page canonical-elsewhere signal as needs attention", () => {
    const assessment = evaluateCrawlFoundations({
      context: selcukContext({
        pages: [
          page("https://selcukdemirci.me/"),
          page("https://selcukdemirci.me/about", {
            canonical: "https://other.example/about",
          }),
          page("https://selcukdemirci.me/contact"),
        ],
      }),
      findings: [
        finding({
          ruleKey: "indexability.canonical_points_elsewhere",
          pageUrl: "https://selcukdemirci.me/about",
        }),
      ],
    });

    expect(assessment.checks.indexability.status).toBe("needs_attention");
    expect(interpretFoundationNextStep(assessment, null).code).toBe(
      "review_indexability_block",
    );
  });

  it("does not treat a utility noindex page as an important indexability blocker", () => {
    const assessment = evaluateCrawlFoundations({
      context: selcukContext({
        pages: [
          ...selcukContext().pages,
          page("https://selcukdemirci.me/privacy", {
            id: "page-privacy",
            robotsMeta: "noindex",
          }),
        ],
      }),
      findings: [
        finding({
          ruleKey: "indexability.noindex",
          pageUrl: "https://selcukdemirci.me/privacy",
        }),
      ],
    });

    expect(assessment.checks.indexability.status).toBe("verified");
    expect(assessment.hasImportantIndexabilityBlock).toBe(false);
  });

  it("leads with a homepage robots disallow blocker", () => {
    const assessment = evaluateCrawlFoundations({
      context: selcukContext({
        pages: [],
        queue: [
          {
            id: "queue-home",
            url: "https://selcukdemirci.me/",
            status: "skipped",
            skipReason: "robots_disallow",
          },
        ],
        artifacts: [
          {
            id: "robots",
            artifactType: "robots_txt",
            url: "https://selcukdemirci.me/robots.txt",
            statusCode: 200,
            parsed: { allow: [], disallow: ["/"], sitemaps: [] },
          },
        ],
      }),
      findings: [
        finding({
          ruleKey: "indexability.robots_blocked_url",
          pageUrl: "https://selcukdemirci.me/",
        }),
      ],
    });

    expect(assessment.homepageBlock).toBe("robots_disallow");
    expect(assessment.checks.crawlability.status).toBe("needs_attention");
    expect(assessment.checks.importantPages.status).toBe("needs_attention");
    expect(interpretFoundationNextStep(assessment, { kind: "empty", windowDays: 28 }).code).toBe(
      "review_homepage_block",
    );
  });

  it("returns data unavailable crawl checks when there is no persisted evidence context", () => {
    const assessment = evaluateCrawlFoundations({ context: null, findings: [] });
    expect(assessment.crawlRunId).toBeNull();
    expect(assessment.checks.importantPages.status).toBe("data_unavailable");
    expect(assessment.checks.crawlability.status).toBe("data_unavailable");
    expect(assessment.checks.indexability.status).toBe("data_unavailable");
    expect(assessment.checks.sitemap.status).toBe("data_unavailable");
    expect(interpretFoundationNextStep(assessment, null).code).toBe("no_scan");
  });
});

describe("Google performance and indexing", () => {
  it("never treats empty or reported analytics as an indexing result", () => {
    expect(evaluateGooglePerformance({ kind: "empty", windowDays: 28 }).status).toBe(
      "data_unavailable",
    );
    expect(evaluateGooglePerformance({ kind: "empty", windowDays: 28 }).detail).toMatch(
      /not proof that Google has not indexed/i,
    );
    expect(evaluateGooglePerformance({ kind: "reported", windowDays: 28, queriesReported: 4 }).status).toBe(
      "verified",
    );
    expect(
      evaluateGooglePerformance({ kind: "reported", windowDays: 28, queriesReported: 4 }).summary,
    ).toMatch(/not an indexing check/i);
    expect(googleIndexingCheck().status).toBe("not_checked");
    expect(googleIndexingCheck().summary).toMatch(/has not checked whether Google has indexed/i);
  });

  it("keeps unauthorized and unsynced sessions as data unavailable", () => {
    expect(evaluateGooglePerformance({ kind: "no_session" }).status).toBe("data_unavailable");
    expect(evaluateGooglePerformance({ kind: "not_connected" }).status).toBe("data_unavailable");
    expect(evaluateGooglePerformance({ kind: "not_synced" }).status).toBe("data_unavailable");
    expect(evaluateGooglePerformance({ kind: "unavailable" }).status).toBe("data_unavailable");
  });

  it("does not reuse Google performance evidence from another website while a new request is loading", () => {
    const stored = {
      websiteId: "website-a",
      evidence: {
        kind: "reported" as const,
        windowDays: 28,
        queriesReported: 12,
      },
      view: { status: "completed", empty: false, summary: { queriesReported: 12 } },
      loadError: null,
    };

    expect(selectGoogleEvidenceForWebsite(stored, "website-b")).toBeNull();
    expect(selectGoogleEvidenceForWebsite(stored, "website-a")).toEqual(stored.evidence);
    expect(
      selectGoogleEvidenceForWebsite(
        { websiteId: "website-b", evidence: null, view: null, loadError: null },
        "website-b",
      ),
    ).toBeNull();
    expect(
      evaluateGooglePerformance(selectGoogleEvidenceForWebsite(stored, "website-b")).summary,
    ).not.toMatch(/Google reported search performance|12 queries/i);
    expect(
      evaluateGooglePerformance(selectGoogleEvidenceForWebsite(stored, "website-a")).summary,
    ).toMatch(/Google reported search performance/i);

    const firstRenderForB = visibleGoogleEvidenceForWebsite(stored, "website-b");
    expect(firstRenderForB.websiteId).toBe("website-b");
    expect(firstRenderForB.evidence).toBeNull();
    expect(firstRenderForB.view).toBeNull();
    expect(firstRenderForB.loadError).toBeNull();
    expect(
      evaluateGooglePerformance(firstRenderForB.evidence).summary,
    ).not.toMatch(/Google reported search performance|12 queries/i);
  });

  it("does not explain a completed empty sync as unauthorized or unavailable GSC data", () => {
    const empty = evaluateGooglePerformance({ kind: "empty", windowDays: 28 });
    const unauthorized = [
      evaluateGooglePerformance({ kind: "no_session" }),
      evaluateGooglePerformance({ kind: "not_connected" }),
      evaluateGooglePerformance({ kind: "not_synced" }),
      evaluateGooglePerformance({ kind: "unavailable" }),
    ];

    expect(empty.summary).toMatch(/synced, but reported no queries/i);
    expect(empty.summary).not.toMatch(/unavailable|connect Google|not connected|could not load/i);
    expect(empty.detail).toMatch(/completed sync/i);
    for (const other of unauthorized) {
      expect(other.summary).not.toEqual(empty.summary);
      expect(other.summary).not.toMatch(/synced, but reported no queries/i);
    }
    expect(googleIndexingCheck().status).toBe("not_checked");
  });
});

describe("interpretFoundationNextStep", () => {
  it("uses one wait-for-discovery step for the selcuk empty-GSC case", () => {
    const assessment = evaluateCrawlFoundations({
      context: selcukContext(),
      findings: [
        finding({
          ruleKey: "page_fundamentals.missing_meta_description",
          pageUrl: "https://selcukdemirci.me/about",
        }),
      ],
    });
    const next = interpretFoundationNextStep(assessment, { kind: "empty", windowDays: 28 });

    expect(next.code).toBe("wait_for_google_discovery");
    expect(next.message).toMatch(/let Google discover/i);
    expect(next.message).toMatch(/not asking you to rewrite titles or submit changes yet/i);
    expect(next.message).not.toMatch(/you should rewrite|submit the sitemap|request indexing/i);
    expect(next.message).toMatch(/has not inspected Google's index/i);
  });

  it("does not recommend a rewrite when Google performance is simply unavailable", () => {
    const assessment = evaluateCrawlFoundations({
      context: selcukContext(),
      findings: [],
    });
    const next = interpretFoundationNextStep(assessment, { kind: "no_session" });
    expect(next.code).toBe("connect_google_for_performance");
    expect(next.message).not.toMatch(/rewrite|title|meta description/i);
  });

  it("distinguishes connected-not-synced, not connected, and unavailable Google states", () => {
    const assessment = evaluateCrawlFoundations({
      context: selcukContext(),
      findings: [],
    });

    const notSynced = interpretFoundationNextStep(assessment, { kind: "not_synced" });
    const notConnected = interpretFoundationNextStep(assessment, { kind: "not_connected" });
    const unavailable = interpretFoundationNextStep(assessment, { kind: "unavailable" });
    const empty = interpretFoundationNextStep(assessment, { kind: "empty", windowDays: 28 });

    expect(notSynced.code).toBe("sync_google_performance");
    expect(notSynced.message).toMatch(/owner-started/i);
    expect(notSynced.message).toMatch(/does not ask Google to index/i);
    expect(notConnected.code).toBe("google_not_connected");
    expect(notConnected.message).toMatch(/Search Console is not connected/i);
    expect(unavailable.code).toBe("google_unavailable");
    expect(unavailable.message).toMatch(/could not load Google search analytics/i);
    expect(empty.code).toBe("wait_for_google_discovery");
    expect(new Set([notSynced.code, notConnected.code, unavailable.code, empty.code]).size).toBe(4);
  });
});

function indexingUrl(
  overrides: Partial<GoogleIndexingUrlEvidence> & Pick<GoogleIndexingUrlEvidence, "url" | "role" | "verdict">,
): GoogleIndexingUrlEvidence {
  return {
    coverageState: null,
    indexingState: null,
    robotsTxtState: null,
    pageFetchState: null,
    lastCrawlTime: null,
    inspectedAt: "2026-11-02T23:00:00.000Z",
    userCanonical: null,
    googleCanonical: null,
    canonicalMismatch: false,
    referringUrls: [],
    sitemaps: [],
    reason: null,
    ...overrides,
  };
}

function checkedIndexing(
  urls: GoogleIndexingUrlEvidence[],
  interpretation: "listed_and_processed" | "listed_pending_or_errors" | "none_listed" = "none_listed",
): GoogleIndexingEvidenceInput {
  return {
    kind: "checked",
    inspectedAt: "2026-11-02T23:00:00.000Z",
    reused: false,
    urls,
    sitemap: {
      crawledSitemapUrls: ["https://selcukdemirci.me/sitemap.xml"],
      listedInSearchConsole: interpretation !== "none_listed",
      sitemaps: [],
      interpretation,
    },
  };
}

describe("Google indexing observation", () => {
  it("A. marks an explicit indexed homepage as verified without treating analytics as indexing", () => {
    const check = googleIndexingCheck(
      checkedIndexing([
        indexingUrl({
          url: "https://selcukdemirci.me/",
          role: "homepage",
          verdict: "indexed",
          coverageState: "Submitted and indexed",
          indexingState: "INDEXING_ALLOWED",
          reason: "Submitted and indexed",
        }),
      ]),
    );
    expect(check.status).toBe("verified");
    expect(check.summary).toMatch(/homepage as indexed/i);
    expect(check.detail).toMatch(/not a live URL test/i);
    expect(check.detail).toMatch(/INDEXING_ALLOWED is not proof of indexing/i);
  });

  it("B/C/D. treats unknown, crawled-not-indexed, and noindex homepage results as needs attention", () => {
    expect(
      googleIndexingCheck(
        checkedIndexing([
          indexingUrl({
            url: "https://selcukdemirci.me/",
            role: "homepage",
            verdict: "not_indexed",
            coverageState: "URL is unknown to Google",
            reason: "URL is unknown to Google",
          }),
        ]),
      ).status,
    ).toBe("needs_attention");
    expect(
      googleIndexingCheck(
        checkedIndexing([
          indexingUrl({
            url: "https://selcukdemirci.me/",
            role: "homepage",
            verdict: "not_indexed",
            coverageState: "Crawled - currently not indexed",
            reason: "Crawled - currently not indexed",
          }),
        ]),
      ).summary,
    ).toMatch(/homepage is not indexed/i);
    expect(
      googleIndexingCheck(
        checkedIndexing([
          indexingUrl({
            url: "https://selcukdemirci.me/",
            role: "homepage",
            verdict: "not_indexed",
            coverageState: "Excluded by ‘noindex’ tag",
            indexingState: "BLOCKED_BY_META_TAG",
            reason: "Excluded by ‘noindex’ tag",
          }),
        ]),
      ).status,
    ).toBe("needs_attention");
  });

  it("E. treats a Google-selected canonical mismatch as needs attention even when indexed", () => {
    const check = googleIndexingCheck(
      checkedIndexing([
        indexingUrl({
          url: "https://selcukdemirci.me/about",
          role: "important_page",
          verdict: "indexed",
          canonicalMismatch: true,
          userCanonical: "https://selcukdemirci.me/about",
          googleCanonical: "https://selcukdemirci.me/",
        }),
      ]),
    );
    expect(check.status).toBe("needs_attention");
    expect(check.summary).toMatch(/canonical issue/i);
  });

  it("F. keeps missing inspection fields as not a live indexed result", () => {
    const check = googleIndexingCheck(
      checkedIndexing([
        indexingUrl({
          url: "https://selcukdemirci.me/",
          role: "homepage",
          verdict: "unknown",
          indexingState: "INDEXING_ALLOWED",
        }),
      ]),
    );
    expect(check.status).toBe("data_unavailable");
    expect(check.summary).toMatch(/did not clearly report/i);
  });

  it("J. keeps empty Search Analytics distinct from an indexed homepage", () => {
    const assessment = evaluateCrawlFoundations({
      context: selcukContext(),
      findings: [],
    });
    const next = interpretFoundationNextStep(
      assessment,
      { kind: "empty", windowDays: 28 },
      checkedIndexing([
        indexingUrl({
          url: "https://selcukdemirci.me/",
          role: "homepage",
          verdict: "indexed",
          coverageState: "Submitted and indexed",
        }),
      ]),
    );
    expect(next.code).toBe("wait_for_google_discovery");
    expect(next.message).toMatch(/homepage as indexed/i);
    expect(next.message).toMatch(/Search performance can stay empty/i);
    expect(next.message).not.toMatch(/you should rewrite/i);
  });

  it("K. keeps empty Search Analytics and an unknown URL from becoming an indexed claim", () => {
    const assessment = evaluateCrawlFoundations({
      context: selcukContext(),
      findings: [],
    });
    const next = interpretFoundationNextStep(
      assessment,
      { kind: "empty", windowDays: 28 },
      checkedIndexing([
        indexingUrl({
          url: "https://selcukdemirci.me/",
          role: "homepage",
          verdict: "unknown",
        }),
      ]),
    );
    expect(next.code).toBe("wait_for_google_discovery");
    expect(next.message).toMatch(/indexing is unknown/i);
    expect(next.message).not.toMatch(/homepage as indexed/i);
  });
});
