import { describe, expect, it } from "vitest";
import type { WebsiteOverview } from "@/lib/websites/types";
import { formatComparisonNarrative } from "@/lib/analysis/comparison-display";
import {
  SITE_HIGHLIGHT_MAX,
  buildHighlightedFindingsForSitePage,
  buildSiteOverviewLinks,
  buildSiteProgressContent,
  buildSiteResultsDisplayModel,
  buildSiteWhatMattersContent,
  formatHistoryFindingsLabel,
  formatSiteMetadataLine,
  shouldShowActiveScanBanner,
  shouldShowCurrentState,
} from "./site-overview-view-model";

function createOverview(
  overrides: Partial<WebsiteOverview> = {},
): WebsiteOverview {
  return {
    website: {
      id: "website-1",
      hostname: "ekoiq.com",
      displayUrl: "https://www.ekoiq.com/",
      firstSeenAt: "2026-09-10T00:00:00.000Z",
      lastCrawledAt: "2026-09-11T00:00:00.000Z",
    },
    latestUsableScan: {
      crawlRunId: "run-usable",
      completedAt: "2026-09-10T15:01:00.000Z",
      pagesCrawled: 10,
      findings: [],
      findingsSummary: {
        totalCount: 22,
        highlightedFindingIds: ["finding-1", "finding-2", "finding-3", "finding-4"],
        highlightGroups: [
          {
            representativeFindingId: "finding-2",
            memberFindingIds: ["finding-2"],
            rawFindingCount: 3,
            affectedPageCount: 4,
          },
        ],
      },
      comparison: {
        previousCrawlRunId: "run-prev",
        previousCompletedAt: "2026-09-09T15:01:00.000Z",
        fixed: 2,
        stillPresent: 14,
        new: 3,
        unverified: 1,
        fixedFindings: [],
      },
      searchPresence: null,
      explanationEnrichmentStatus: "ready",
    },
    highlightedFindings: [
      {
        id: "finding-1",
        ruleKey: "page_fundamentals.missing_title",
        category: "page_fundamentals",
        severity: "warning",
        title: "Missing title",
        description: "Missing title",
        pageUrl: "https://www.ekoiq.com/about",
        evidence: {},
        priority: {
          level: "high",
          rank: 1,
          whyItMatters: "Titles matter",
          recommendedAction: "Add a title",
          verification: null,
        },
      },
      {
        id: "finding-2",
        ruleKey: "internal_structure.broken_internal_link",
        category: "internal_structure",
        severity: "error",
        title: "Broken link",
        description: "Broken link",
        pageUrl: "https://www.ekoiq.com/",
        evidence: { linkToUrl: "https://www.ekoiq.com/old" },
        priority: {
          level: "critical",
          rank: 2,
          whyItMatters: "Broken links matter",
          recommendedAction: "Fix the link",
          verification: null,
        },
      },
      {
        id: "finding-3",
        ruleKey: "page_fundamentals.missing_meta_description",
        category: "page_fundamentals",
        severity: "warning",
        title: "Missing meta description",
        description: "Missing meta description",
        pageUrl: "https://www.ekoiq.com/contact",
        evidence: {},
        priority: null,
      },
    ],
    activeScan: null,
    scanHistory: [],
    ...overrides,
  };
}

describe("site overview view model", () => {
  it("keeps latest usable scan as primary state while active scan exists separately", () => {
    const overview = createOverview({
      activeScan: {
        crawlRunId: "run-active",
        status: "running",
        pagesCrawled: 2,
        maxPages: 10,
      },
    });

    expect(shouldShowCurrentState(overview)).toBe(true);
    expect(shouldShowActiveScanBanner(overview)).toBe(true);
    expect(buildSiteOverviewLinks(overview).latestScanHref).toBe("/scan/run-usable");
    expect(buildSiteOverviewLinks(overview).activeScanHref).toBe("/scan/run-active");
  });

  it("caps highlighted findings at three", () => {
    const overview = createOverview();
    const highlights = buildHighlightedFindingsForSitePage(
      overview.highlightedFindings,
      overview.latestUsableScan!.findingsSummary,
    );

    expect(highlights).toHaveLength(SITE_HIGHLIGHT_MAX);
    expect(highlights[1]?.highlightAggregation?.affectedPageCount).toBe(4);
  });

  it("links full analysis to the latest usable crawl id", () => {
    const links = buildSiteOverviewLinks(createOverview());
    expect(links.latestScanHref).toBe("/scan/run-usable");
  });

  it("renders first-scan progress copy when comparison is missing", () => {
    const progress = buildSiteProgressContent(null);
    expect(progress.kind).toBe("first_scan");
    expect(progress.copy).toContain("first scan");
  });

  it("renders editorial comparison narrative", () => {
    const progress = buildSiteProgressContent(createOverview().latestUsableScan!.comparison);
    expect(progress.kind).toBe("comparison");
    expect(progress.copy).toBe(
      "2 findings fixed. 3 new findings appeared. 14 findings are still present. 1 could not be verified.",
    );
  });

  it("uses the no-highlight product meaning when findings exist without highlights", () => {
    const content = buildSiteWhatMattersContent(
      createOverview({
        latestUsableScan: {
          ...createOverview().latestUsableScan!,
          findingsSummary: {
            totalCount: 5,
            highlightedFindingIds: [],
            highlightGroups: [],
          },
        },
        highlightedFindings: [],
      }),
    );

    expect(content.kind).toBe("empty_highlights");
    if (content.kind === "empty_highlights") {
      expect(content.title).toBe("We could open your website.");
      expect(content.description).toContain(
        "We cannot see whether Google has listed your site",
      );
    }
  });

  it("uses zero-findings language for successful empty scans", () => {
    const content = buildSiteWhatMattersContent(
      createOverview({
        latestUsableScan: {
          ...createOverview().latestUsableScan!,
          findingsSummary: {
            totalCount: 0,
            highlightedFindingIds: [],
            highlightGroups: [],
          },
        },
        highlightedFindings: [],
      }),
    );

    expect(content.kind).toBe("zero_findings");
    if (content.kind === "zero_findings") {
      expect(content.title).toBe("We could open your website.");
      expect(content.description).toContain(
        "We cannot see whether Google has listed your site",
      );
      expect(content.title).not.toBe("No notable issues found.");
    }
  });

  it("includes sitemap wording on the site empty brief when that evidence is true", () => {
    const content = buildSiteWhatMattersContent(
      createOverview({
        latestUsableScan: {
          ...createOverview().latestUsableScan!,
          findings: [],
          findingsSummary: {
            totalCount: 0,
            highlightedFindingIds: [],
            highlightGroups: [],
          },
          searchPresence: {
            homepageBlock: null,
            homepageDiscovery: "sitemap",
          },
        },
        highlightedFindings: [],
      }),
    );

    expect(content.kind).toBe("zero_findings");
    if (content.kind === "zero_findings") {
      expect(content.description).toContain("That page is in your sitemap.");
    }
  });

  it("keeps a homepage non_200 job in What matters now instead of a ready sentence", () => {
    const content = buildSiteWhatMattersContent(
      createOverview({
        latestUsableScan: {
          ...createOverview().latestUsableScan!,
          findings: [
            {
              id: "home-403",
              ruleKey: "indexability.non_200_page",
              category: "indexability",
              severity: "error",
              title: "Page did not return HTTP 200",
              description: "The homepage returned 403.",
              pageUrl: "https://www.ekoiq.com/",
              evidence: { statusCode: 403 },
              priority: {
                level: "high",
                rank: 1,
                whyItMatters: "Search engines may not list this page.",
                recommendedAction: "Fix the response.",
                verification: null,
              },
            },
          ],
          findingsSummary: {
            totalCount: 1,
            highlightedFindingIds: ["home-403"],
            highlightGroups: [
              {
                representativeFindingId: "home-403",
                memberFindingIds: ["home-403"],
                rawFindingCount: 1,
                affectedPageCount: 1,
              },
            ],
          },
          searchPresence: {
            homepageBlock: "non_200",
            homepageDiscovery: null,
          },
        },
        highlightedFindings: [],
      }),
    );

    expect(content.kind).toBe("highlights");
    if (content.kind === "highlights") {
      expect(content.findings[0]?.ruleKey).toBe("indexability.non_200_page");
    }
  });

  it("does not display null findings counts as zero", () => {
    expect(formatHistoryFindingsLabel(null)).toBeNull();
    expect(formatHistoryFindingsLabel(0)).toBe("0 findings");
    expect(formatHistoryFindingsLabel(22)).toBe("22 findings");
  });

  it("links history rows to their own crawl ids", () => {
    const links = buildSiteOverviewLinks(
      createOverview({
        scanHistory: [
          {
            crawlRunId: "run-failed",
            status: "failed",
            createdAt: "2026-09-11T00:00:00.000Z",
            startedAt: null,
            completedAt: "2026-09-11T00:01:00.000Z",
            pagesCrawled: 0,
            findingsCount: null,
          },
          {
            crawlRunId: "run-usable",
            status: "completed",
            createdAt: "2026-09-10T00:00:00.000Z",
            startedAt: null,
            completedAt: "2026-09-10T15:01:00.000Z",
            pagesCrawled: 10,
            findingsCount: 22,
          },
        ],
      }),
    );

    expect(links.historyHrefs).toEqual(["/scan/run-failed", "/scan/run-usable"]);
  });
});

describe("formatComparisonNarrative", () => {
  it("builds a readable sentence from comparison counts", () => {
    expect(
      formatComparisonNarrative({
        previousCrawlRunId: "prev",
        previousCompletedAt: "2026-09-09T00:00:00.000Z",
        fixed: 1,
        stillPresent: 0,
        new: 1,
        unverified: 0,
        fixedFindings: [],
      }),
    ).toBe("1 finding fixed. 1 new finding appeared.");
  });
});

describe("site work-list grouping", () => {
  it("uses the same action grouping and job count as /scan", () => {
    const overview = createOverview({
      latestUsableScan: {
        ...createOverview().latestUsableScan!,
        findings: [
          {
            id: "title-1",
            ruleKey: "page_fundamentals.duplicate_title",
            category: "page_fundamentals",
            severity: "warning",
            title: "Duplicate page title",
            description: "Duplicate",
            pageUrl: "https://example.com/",
            evidence: { title: "Home" },
            priority: {
              level: "high",
              rank: 1,
              whyItMatters: "Why",
              recommendedAction: "Fix",
              verification: "Verify",
            },
          },
          {
            id: "title-2",
            ruleKey: "page_fundamentals.duplicate_title",
            category: "page_fundamentals",
            severity: "warning",
            title: "Duplicate page title",
            description: "Duplicate",
            pageUrl: "https://example.com/ca",
            evidence: { title: "Home" },
            priority: {
              level: "high",
              rank: 2,
              whyItMatters: "Why",
              recommendedAction: "Fix",
              verification: "Verify",
            },
          },
          {
            id: "meta-1",
            ruleKey: "page_fundamentals.missing_meta_description",
            category: "page_fundamentals",
            severity: "warning",
            title: "Missing meta description",
            description: "Missing",
            pageUrl: "https://example.com/about",
            evidence: {},
            priority: {
              level: "medium",
              rank: 3,
              whyItMatters: "Why",
              recommendedAction: "Fix",
              verification: "Verify",
            },
          },
        ],
      },
    });

    const model = buildSiteResultsDisplayModel(overview);
    expect(model?.actionGroupCount).toBe(2);
    expect(model?.highlightCards[0]?.title).toBe("Duplicate page titles");
    expect(model?.highlightCards[0]?.affectedUrls).toEqual([
      "https://example.com/",
      "https://example.com/ca",
    ]);
    expect(
      formatSiteMetadataLine({
        pagesCrawled: 10,
        jobCount: model?.actionGroupCount ?? 0,
        completedAt: "2026-09-10T15:01:00.000Z",
      }),
    ).toContain("Based on 10 analyzed pages");
    expect(
      formatSiteMetadataLine({
        pagesCrawled: 10,
        jobCount: model?.actionGroupCount ?? 0,
        completedAt: "2026-09-10T15:01:00.000Z",
      }),
    ).toContain("2 jobs");
  });
});
