import { describe, expect, it } from "vitest";
import { buildStoredObservation } from "@/lib/priorities/fixtures/test-helpers";
import { compareObservations } from "./compare-crawls";
import {
  buildEmptyCoverage,
  withBrokenLink,
  withCrawledPage,
} from "./fixtures/test-helpers";
import { normalizeComparisonUrl } from "./normalize-comparison-url";

const PREVIOUS_RUN = {
  previousCrawlRunId: "prev-run",
  previousCompletedAt: "2026-01-01T00:00:00.000Z",
};

function compare(
  previousObservations: ReturnType<typeof buildStoredObservation>[],
  currentObservations: ReturnType<typeof buildStoredObservation>[],
  coverage = buildEmptyCoverage(),
) {
  return compareObservations({
    previousObservations,
    currentObservations,
    coverage,
    ...PREVIOUS_RUN,
  });
}

describe("compareObservations", () => {
  it("classifies the same deterministic issue as still present across different UUIDs", () => {
    const previous = buildStoredObservation({
      id: "prev-obs",
      ruleKey: "page_fundamentals.missing_title",
      subjectKey: "page:old-uuid:missing_title",
      pageUrl: "https://example.com/about",
      evidence: { finalUrl: "https://example.com/about" },
    });
    const current = buildStoredObservation({
      id: "curr-obs",
      ruleKey: "page_fundamentals.missing_title",
      subjectKey: "page:new-uuid:missing_title",
      pageUrl: "https://www.example.com/about",
      evidence: { finalUrl: "https://www.example.com/about" },
    });
    const coverage = withCrawledPage(buildEmptyCoverage(), "https://example.com/about");

    const result = compare([previous], [current], coverage);

    expect(result.comparison.stillPresent).toBe(1);
    expect(result.comparison.new).toBe(0);
    expect(result.comparison.fixed).toBe(0);
    expect(result.comparison.unverified).toBe(0);
    expect(result.changeStatusByObservationId.get("curr-obs")).toBe("still_present");
  });

  it("classifies a new issue as new", () => {
    const current = buildStoredObservation({
      id: "curr-new",
      ruleKey: "indexability.canonical_missing",
      subjectKey: "page:new:canonical_missing",
      pageUrl: "https://example.com/pricing",
      evidence: { finalUrl: "https://example.com/pricing" },
    });

    const result = compare([], [current]);

    expect(result.comparison.new).toBe(1);
    expect(result.changeStatusByObservationId.get("curr-new")).toBe("new");
  });

  it("does not classify absent-but-not-recrawled findings as fixed", () => {
    const previous = buildStoredObservation({
      id: "prev-missing-title",
      ruleKey: "page_fundamentals.missing_title",
      subjectKey: "page:old:missing_title",
      pageUrl: "https://example.com/about",
      evidence: { finalUrl: "https://example.com/about" },
    });

    const result = compare([previous], [], buildEmptyCoverage());

    expect(result.comparison.fixed).toBe(0);
    expect(result.comparison.unverified).toBe(1);
    expect(result.comparison.fixedFindings).toHaveLength(0);
  });

  it("classifies verified disappearance as fixed", () => {
    const previous = buildStoredObservation({
      id: "prev-canonical",
      ruleKey: "indexability.canonical_missing",
      subjectKey: "page:old:canonical_missing",
      pageUrl: "https://example.com/pricing",
      evidence: { finalUrl: "https://example.com/pricing" },
    });
    const coverage = withCrawledPage(buildEmptyCoverage(), "https://example.com/pricing");

    const result = compare([previous], [], coverage);

    expect(result.comparison.fixed).toBe(1);
    expect(result.comparison.unverified).toBe(0);
    expect(result.comparison.fixedFindings[0]?.title).toBe(
      "Canonical URL missing",
    );
  });

  it("handles partial broken-link improvement at raw finding level", () => {
    const target = "https://example.com/dead";
    const previous = [
      buildStoredObservation({
        id: "prev-link-1",
        ruleKey: "internal_structure.broken_internal_link",
        subjectKey: "link:1",
        pageUrl: "https://example.com/page-1",
        evidence: { linkToUrl: target },
      }),
      buildStoredObservation({
        id: "prev-link-2",
        ruleKey: "internal_structure.broken_internal_link",
        subjectKey: "link:2",
        pageUrl: "https://example.com/page-2",
        evidence: { linkToUrl: target },
      }),
    ];
    const current = [
      buildStoredObservation({
        id: "curr-link-1",
        ruleKey: "internal_structure.broken_internal_link",
        subjectKey: "link:3",
        pageUrl: "https://example.com/page-1",
        evidence: { linkToUrl: target },
      }),
    ];

    const coverage = buildEmptyCoverage();
    withBrokenLink(coverage, "https://example.com/page-1", target, 404);
    withCrawledPage(coverage, "https://example.com/page-2");

    const result = compare(previous, current, coverage);

    expect(result.comparison.stillPresent).toBe(1);
    expect(result.comparison.fixed).toBe(1);
    expect(result.comparison.unverified).toBe(0);
    expect(result.changeStatusByObservationId.get("curr-link-1")).toBe(
      "still_present",
    );
  });

  it("marks broken links as unverified when source was recrawled but target was not checked", () => {
    const source = "https://example.com/source";
    const target = "https://example.com/dead";
    const previous = buildStoredObservation({
      id: "prev-broken",
      ruleKey: "internal_structure.broken_internal_link",
      subjectKey: "link:old",
      pageUrl: source,
      evidence: { linkToUrl: target },
    });

    const coverage = buildEmptyCoverage();
    withCrawledPage(coverage, source);
    const outgoing = coverage.outgoingLinksBySource.get(source) ?? new Set<string>();
    outgoing.add(target);
    coverage.outgoingLinksBySource.set(source, outgoing);

    const result = compare([previous], [], coverage);

    expect(result.comparison.fixed).toBe(0);
    expect(result.comparison.unverified).toBe(1);
  });

  it("marks broken links as fixed when the source was recrawled and the link was removed", () => {
    const source = "https://example.com/source";
    const target = "https://example.com/dead";
    const previous = buildStoredObservation({
      id: "prev-broken",
      ruleKey: "internal_structure.broken_internal_link",
      subjectKey: "link:old",
      pageUrl: source,
      evidence: { linkToUrl: target },
    });
    const coverage = withCrawledPage(buildEmptyCoverage(), source);

    const result = compare([previous], [], coverage);

    expect(result.comparison.fixed).toBe(1);
    expect(result.comparison.unverified).toBe(0);
  });

  it("marks broken links as fixed when target was recrawled and is healthy", () => {
    const source = "https://example.com/source";
    const target = "https://example.com/dead";
    const previous = buildStoredObservation({
      id: "prev-broken",
      ruleKey: "internal_structure.broken_internal_link",
      subjectKey: "link:old",
      pageUrl: source,
      evidence: { linkToUrl: target },
    });

    const coverage = buildEmptyCoverage();
    withCrawledPage(coverage, source);
    withCrawledPage(coverage, target, 200);
    const outgoing = coverage.outgoingLinksBySource.get(source) ?? new Set<string>();
    outgoing.add(target);
    coverage.outgoingLinksBySource.set(source, outgoing);

    const result = compare([previous], [], coverage);

    expect(result.comparison.fixed).toBe(1);
    expect(result.comparison.unverified).toBe(0);
  });

  it("compares duplicate title membership changes per page", () => {
    const previousPageA = buildStoredObservation({
      id: "prev-a",
      ruleKey: "page_fundamentals.duplicate_title",
      subjectKey: "page:a:duplicate_title",
      pageUrl: "https://example.com/a",
      evidence: {
        title: "Same",
        duplicatePages: ["https://example.com/a", "https://example.com/b"],
      },
    });
    const previousPageB = buildStoredObservation({
      id: "prev-b",
      ruleKey: "page_fundamentals.duplicate_title",
      subjectKey: "page:b:duplicate_title",
      pageUrl: "https://example.com/b",
      evidence: {
        title: "Same",
        duplicatePages: ["https://example.com/a", "https://example.com/b"],
      },
    });
    const currentPageB = buildStoredObservation({
      id: "curr-b",
      ruleKey: "page_fundamentals.duplicate_title",
      subjectKey: "page:b-new:duplicate_title",
      pageUrl: "https://example.com/b",
      evidence: {
        title: "Same",
        duplicatePages: ["https://example.com/b", "https://example.com/c"],
      },
    });

    const coverage = buildEmptyCoverage();
    withCrawledPage(coverage, "https://example.com/a");
    withCrawledPage(coverage, "https://example.com/b");

    const result = compare(
      [previousPageA, previousPageB],
      [currentPageB],
      coverage,
    );

    expect(result.comparison.stillPresent).toBe(1);
    expect(result.comparison.fixed).toBe(1);
    expect(result.comparison.new).toBe(0);
    expect(result.comparison.unverified).toBe(0);
  });

  it("does not mark a sitemap URL issue fixed when the URL was only rediscovered and queued", () => {
    const sitemapUrl = "https://www.dbhobby.com/ca/tint-hdupont-per-a-pintura-en-seda";
    const previous = buildStoredObservation({
      id: "prev-sitemap-issue",
      ruleKey: "site_discovery.sitemap_url_issue",
      subjectKey: "url:tint-hdupont:sitemap_url_issue",
      pageUrl: sitemapUrl,
      evidence: {
        sitemapUrl,
        queueStatus: "failed",
        queueSkipReason: "Request timed out.",
        pageStatusCode: null,
        requestedUrl: null,
        finalUrl: null,
      },
    });

    const coverage = buildEmptyCoverage();
    const normalized = normalizeComparisonUrl(sitemapUrl);
    if (normalized) {
      coverage.sitemapUrls.add(normalized);
      coverage.queuedUrls.add(normalized);
    }

    const result = compare([previous], [], coverage);

    expect(result.comparison.fixed).toBe(0);
    expect(result.comparison.unverified).toBe(1);
    expect(result.comparison.fixedFindings).toHaveLength(0);
  });

  it("marks a sitemap URL issue fixed when the page was fetched and the issue is gone", () => {
    const sitemapUrl = "https://www.dbhobby.com/ca/tint-hdupont-per-a-pintura-en-seda";
    const previous = buildStoredObservation({
      id: "prev-sitemap-issue",
      ruleKey: "site_discovery.sitemap_url_issue",
      subjectKey: "url:tint-hdupont:sitemap_url_issue",
      pageUrl: sitemapUrl,
      evidence: {
        sitemapUrl,
        queueStatus: "failed",
        queueSkipReason: "Request timed out.",
        pageStatusCode: null,
        requestedUrl: null,
        finalUrl: null,
      },
    });

    const coverage = withCrawledPage(
      buildEmptyCoverage(),
      normalizeComparisonUrl(sitemapUrl) ?? sitemapUrl,
    );

    const result = compare([previous], [], coverage);

    expect(result.comparison.fixed).toBe(1);
    expect(result.comparison.unverified).toBe(0);
    expect(result.comparison.fixedFindings[0]?.ruleKey).toBe(
      "site_discovery.sitemap_url_issue",
    );
  });

  it("treats site-wide findings as fixed when absent on a completed crawl", () => {
    const previous = buildStoredObservation({
      id: "prev-robots",
      ruleKey: "site_discovery.robots_txt_missing",
      subjectKey: "site:robots_txt",
      evidence: {},
    });

    const result = compare([previous], [], buildEmptyCoverage());

    expect(result.comparison.fixed).toBe(1);
    expect(result.comparison.unverified).toBe(0);
  });

  it("does not change comparison identity when priority-adjacent fields differ", () => {
    const previous = buildStoredObservation({
      id: "prev-1",
      ruleKey: "page_fundamentals.missing_h1",
      subjectKey: "page:old:missing_h1",
      pageUrl: "https://example.com/about",
      evidence: { finalUrl: "https://example.com/about" },
    });
    const current = buildStoredObservation({
      id: "curr-1",
      ruleKey: "page_fundamentals.missing_h1",
      subjectKey: "page:new:missing_h1",
      pageUrl: "https://example.com/about",
      evidence: { finalUrl: "https://example.com/about" },
      title: "Different title copy",
      description: "Different description copy",
    });
    const coverage = withCrawledPage(buildEmptyCoverage(), "https://example.com/about");

    const result = compare([previous], [current], coverage);

    expect(result.comparison.stillPresent).toBe(1);
  });
});
