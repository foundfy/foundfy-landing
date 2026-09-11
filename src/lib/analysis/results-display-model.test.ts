import { describe, expect, it } from "vitest";
import type { AnalysisFinding, FindingsSummary } from "./crawl-status";
import { buildResultsDisplayModel } from "./results-display-model";

function buildFinding(input: {
  id: string;
  ruleKey: string;
  rank: number;
  level: "critical" | "high" | "medium" | "low";
  pageUrl?: string;
  evidence?: Record<string, unknown>;
  title?: string;
}): AnalysisFinding {
  return {
    id: input.id,
    ruleKey: input.ruleKey,
    category: "page_fundamentals",
    severity: "warning",
    title: input.title ?? input.ruleKey,
    description: "Description",
    pageUrl: input.pageUrl ?? `https://example.com/${input.id}`,
    evidence: input.evidence ?? {},
    priority: {
      level: input.level,
      rank: input.rank,
      whyItMatters: "Why",
      recommendedAction: "Action",
      verification: "Verify",
    },
    recommendation: {
      whyItMatters: "Why",
      recommendedAction: "Action",
      verification: "Verify",
    },
  };
}

describe("buildResultsDisplayModel", () => {
  it("groups all findings and keeps affected URLs reachable", () => {
    const findings = [
      buildFinding({
        id: "title-1",
        ruleKey: "page_fundamentals.duplicate_title",
        rank: 1,
        level: "high",
        pageUrl: "https://example.com/a",
        evidence: { title: "Home" },
        title: "Duplicate page title",
      }),
      buildFinding({
        id: "title-2",
        ruleKey: "page_fundamentals.duplicate_title",
        rank: 2,
        level: "high",
        pageUrl: "https://example.com/b",
        evidence: { title: "Home" },
        title: "Duplicate page title",
      }),
      buildFinding({
        id: "meta-1",
        ruleKey: "page_fundamentals.missing_meta_description",
        rank: 3,
        level: "medium",
        pageUrl: "https://example.com/c",
        title: "Missing meta description",
      }),
    ];

    const findingsSummary: FindingsSummary = {
      totalCount: 3,
      highlightedFindingIds: ["title-1"],
      highlightGroups: [
        {
          representativeFindingId: "title-1",
          memberFindingIds: ["title-1", "title-2"],
          rawFindingCount: 2,
          affectedPageCount: 2,
        },
      ],
    };

    const model = buildResultsDisplayModel(findings, findingsSummary);

    expect(model.actionGroupCount).toBe(2);
    expect(model.allFindingCards[0]?.affectedUrls).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
    expect(model.highlightCards[0]?.title).toBe(
      "Duplicate page titles · 2 pages affected",
    );
    expect(model.brief).toBe(
      "Duplicate page titles on 2 pages. Next: missing meta description.",
    );
    expect(model.seriousness).toBe("1 high-priority issue needs attention.");
    expect(model.collapseAllFindings).toBe(false);
  });

  it("collapses All findings when many grouped actions exist", () => {
    const findings = [
      "page_fundamentals.missing_title",
      "page_fundamentals.missing_h1",
      "page_fundamentals.missing_meta_description",
      "indexability.canonical_missing",
    ].map((ruleKey, index) =>
      buildFinding({
        id: ruleKey,
        ruleKey,
        rank: index + 1,
        level: "medium",
      }),
    );

    const model = buildResultsDisplayModel(findings, {
      totalCount: findings.length,
      highlightedFindingIds: findings.slice(0, 3).map((finding) => finding.id),
      highlightGroups: findings.slice(0, 3).map((finding) => ({
        representativeFindingId: finding.id,
        memberFindingIds: [finding.id],
        rawFindingCount: 1,
        affectedPageCount: 1,
      })),
    });

    expect(model.actionGroupCount).toBe(4);
    expect(model.collapseAllFindings).toBe(true);
    expect(model.highlightCards).toHaveLength(3);
  });
});
