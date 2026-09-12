import { describe, expect, it } from "vitest";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import type { HighlightGroup } from "@/lib/findings/highlight-groups";
import { applyGroupedRecommendations } from "./apply-grouped-recommendations";
import { buildFindingRecommendation } from "./build-recommendation";

function buildBrokenLinkFinding(input: {
  id: string;
  pageUrl: string;
}): AnalysisFinding {
  const evidence = {
    linkToUrl: "https://example.com/example",
    targetStatusCode: 404,
  };

  return {
    id: input.id,
    ruleKey: "internal_structure.broken_internal_link",
    category: "internal_structure",
    severity: "error",
    title: "Broken internal link",
    description: "Description",
    pageUrl: input.pageUrl,
    evidence,
    priority: {
      level: "high",
      rank: 1,
      whyItMatters: "Static why",
      recommendedAction: "Static action",
      verification: "Static verify",
    },
    recommendation: buildFindingRecommendation({
      ruleKey: "internal_structure.broken_internal_link",
      pageUrl: input.pageUrl,
      evidence,
      priorityLevel: "high",
    }),
  };
}

describe("applyGroupedRecommendations", () => {
  it("updates only the grouped representative recommendation", () => {
    const findings = [
      buildBrokenLinkFinding({ id: "rep", pageUrl: "https://example.com/a" }),
      buildBrokenLinkFinding({ id: "member-1", pageUrl: "https://example.com/b" }),
      buildBrokenLinkFinding({ id: "member-2", pageUrl: "https://example.com/a" }),
    ];

    const highlightGroups: HighlightGroup[] = [
      {
        groupKey: "broken:example",
        representativeFindingId: "rep",
        memberFindingIds: ["rep", "member-1", "member-2"],
        rawFindingCount: 3,
        affectedPageCount: 2,
      },
    ];

    const updated = applyGroupedRecommendations(findings, highlightGroups);
    const representative = updated.find((finding) => finding.id === "rep");
    const member = updated.find((finding) => finding.id === "member-1");

    expect(representative?.recommendation?.recommendedAction).toContain(
      "2 crawled pages",
    );
    expect(member?.recommendation?.recommendedAction).not.toContain("2 crawled pages");
    expect(updated).toHaveLength(findings.length);
  });

  it("applies grouped copy to same-action page issues", () => {
    const findings: AnalysisFinding[] = [
      {
        id: "title-1",
        ruleKey: "page_fundamentals.missing_title",
        category: "page_fundamentals",
        severity: "warning",
        title: "Missing page title",
        description: "Description",
        pageUrl: "https://example.com/a",
        evidence: {},
        priority: {
          level: "high",
          rank: 1,
          whyItMatters: "Why",
          recommendedAction: "Add a title",
          verification: null,
        },
        recommendation: {
          whyItMatters: "Why",
          recommendedAction: "Add a unique, descriptive title to /a.",
          verification: null,
        },
      },
      {
        id: "title-2",
        ruleKey: "page_fundamentals.missing_title",
        category: "page_fundamentals",
        severity: "warning",
        title: "Missing page title",
        description: "Description",
        pageUrl: "https://example.com/b",
        evidence: {},
        priority: {
          level: "high",
          rank: 2,
          whyItMatters: "Why",
          recommendedAction: "Add a title",
          verification: null,
        },
      },
    ];

    const updated = applyGroupedRecommendations(findings, [
      {
        groupKey: "page_fundamentals.missing_title",
        representativeFindingId: "title-1",
        memberFindingIds: ["title-1", "title-2"],
        rawFindingCount: 2,
        affectedPageCount: 2,
      },
    ]);

    expect(updated[0]?.recommendation?.recommendedAction).toContain("/a");
    expect(updated[1]?.recommendation?.recommendedAction).toBeUndefined();
  });

  it("does not change the findings list shape used by All Findings", () => {
    const findings = [
      buildBrokenLinkFinding({ id: "rep", pageUrl: "https://example.com/a" }),
      buildBrokenLinkFinding({ id: "member-1", pageUrl: "https://example.com/b" }),
    ];

    const highlightGroups: HighlightGroup[] = [
      {
        groupKey: "broken:example",
        representativeFindingId: "rep",
        memberFindingIds: ["rep", "member-1"],
        rawFindingCount: 2,
        affectedPageCount: 2,
      },
    ];

    const updated = applyGroupedRecommendations(findings, highlightGroups);

    expect(updated.map((finding) => finding.id)).toEqual(["rep", "member-1"]);
  });
});
