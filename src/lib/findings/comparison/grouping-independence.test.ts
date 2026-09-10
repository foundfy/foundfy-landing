import { describe, expect, it } from "vitest";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import { buildStoredObservation } from "@/lib/priorities/fixtures/test-helpers";
import { selectHighlightGroups } from "../highlight-groups";
import { compareObservations } from "./compare-crawls";
import { withBrokenLink } from "./fixtures/test-helpers";

describe("comparison independence from highlight grouping", () => {
  it("compares raw broken-link instances even when highlights would group them", () => {
    const target = "https://example.com/dead";
    const previous = [
      buildStoredObservation({
        id: "prev-1",
        ruleKey: "internal_structure.broken_internal_link",
        subjectKey: "link:1",
        pageUrl: "https://example.com/a",
        evidence: { linkToUrl: target },
      }),
      buildStoredObservation({
        id: "prev-2",
        ruleKey: "internal_structure.broken_internal_link",
        subjectKey: "link:2",
        pageUrl: "https://example.com/b",
        evidence: { linkToUrl: target },
      }),
    ];
    const current = [
      buildStoredObservation({
        id: "curr-1",
        ruleKey: "internal_structure.broken_internal_link",
        subjectKey: "link:3",
        pageUrl: "https://example.com/a",
        evidence: { linkToUrl: target },
      }),
    ];

    const coverage = withBrokenLink(
      withBrokenLink(
        {
          crawledPageUrls: new Set<string>(),
          requestedToFinal: new Map(),
          outgoingLinksBySource: new Map(),
          targetStatusByUrl: new Map(),
          queuedUrls: new Set(),
          sitemapUrls: new Set(),
        },
        "https://example.com/a",
        target,
        404,
      ),
      "https://example.com/b",
      target,
      404,
    );
    coverage.crawledPageUrls.add("https://example.com/b");

    const result = compareObservations({
      previousObservations: previous,
      currentObservations: current,
      coverage,
      previousCrawlRunId: "prev-run",
      previousCompletedAt: "2026-01-01T00:00:00.000Z",
    });

    const serializedCurrent: AnalysisFinding[] = current.map((observation) => ({
      id: observation.id,
      ruleKey: observation.ruleKey,
      category: observation.category,
      severity: observation.severity,
      title: observation.title,
      description: observation.description,
      pageUrl: observation.pageUrl ?? null,
      evidence: observation.evidence,
      priority: {
        level: "high",
        rank: 1,
        whyItMatters: "Grouped copy should not matter",
        recommendedAction: "Grouped action should not matter",
        verification: null,
      },
    }));

    const highlightGroups = selectHighlightGroups(serializedCurrent);
    expect(highlightGroups).toHaveLength(1);
    expect(result.comparison.stillPresent).toBe(1);
    expect(result.comparison.fixed).toBe(1);
  });
});
