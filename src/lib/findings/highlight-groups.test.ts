import { describe, expect, it } from "vitest";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import { sortFindings } from "./order";
import { selectHighlightGroups } from "./highlight-groups";

function buildBrokenLinkFinding(input: {
  id: string;
  rank: number;
  linkFromUrl: string;
  linkToUrl: string;
  level?: "critical" | "high" | "medium" | "low";
}): AnalysisFinding {
  return {
    id: input.id,
    ruleKey: "internal_structure.broken_internal_link",
    category: "internal_structure",
    severity: "warning",
    title: "Broken internal link to crawled page",
    description: "Description",
    pageUrl: input.linkFromUrl,
    evidence: {
      linkFromUrl: input.linkFromUrl,
      linkToUrl: input.linkToUrl,
      targetStatusCode: 404,
      anchorText: "Elektriske Biler",
    },
    priority: {
      level: input.level ?? "high",
      rank: input.rank,
      whyItMatters: "Why",
      recommendedAction: "Action",
      verification: null,
    },
  };
}

function buildGenericFinding(input: {
  id: string;
  ruleKey: string;
  rank: number;
  level: "critical" | "high" | "medium" | "low";
}): AnalysisFinding {
  return {
    id: input.id,
    ruleKey: input.ruleKey,
    category: "page_fundamentals",
    severity: "warning",
    title: input.ruleKey,
    description: "Description",
    pageUrl: null,
    evidence: {},
    priority: {
      level: input.level,
      rank: input.rank,
      whyItMatters: "Why",
      recommendedAction: "Action",
      verification: null,
    },
  };
}

describe("selectHighlightGroups", () => {
  it("groups broken-link findings with the same target into one highlight slot", () => {
    const findings = sortFindings([
      buildBrokenLinkFinding({
        id: "broken-1",
        rank: 1,
        linkFromUrl: "https://arngren.net/",
        linkToUrl: "http://www.arngren.net/eltrack-2",
      }),
      buildBrokenLinkFinding({
        id: "broken-2",
        rank: 2,
        linkFromUrl: "https://arngren.net/page-2",
        linkToUrl: "http://www.arngren.net/eltrack-2",
      }),
      buildBrokenLinkFinding({
        id: "broken-3",
        rank: 3,
        linkFromUrl: "https://arngren.net/page-3",
        linkToUrl: "http://www.arngren.net/eltrack-2",
      }),
    ]);

    const groups = selectHighlightGroups(findings);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.representativeFindingId).toBe("broken-1");
    expect(groups[0]?.memberFindingIds).toEqual(["broken-1", "broken-2", "broken-3"]);
    expect(groups[0]?.rawFindingCount).toBe(3);
    expect(groups[0]?.affectedPageCount).toBe(3);
  });

  it("counts affected pages from unique source URLs when raw findings exceed them", () => {
    const findings = sortFindings([
      buildBrokenLinkFinding({
        id: "broken-1",
        rank: 1,
        linkFromUrl: "http://arngren.net/",
        linkToUrl: "http://www.arngren.net/eltrack-2",
      }),
      buildBrokenLinkFinding({
        id: "broken-2",
        rank: 2,
        linkFromUrl: "http://arngren.net/",
        linkToUrl: "http://www.arngren.net/eltrack-2",
      }),
      buildBrokenLinkFinding({
        id: "broken-3",
        rank: 3,
        linkFromUrl: "https://arngren.net/",
        linkToUrl: "http://www.arngren.net/eltrack-2",
      }),
      buildBrokenLinkFinding({
        id: "broken-4",
        rank: 4,
        linkFromUrl: "https://arngren.net/",
        linkToUrl: "http://www.arngren.net/eltrack-2",
      }),
    ]);

    const groups = selectHighlightGroups(findings);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.rawFindingCount).toBe(4);
    expect(groups[0]?.affectedPageCount).toBe(2);
  });

  it("keeps different broken targets as separate highlight groups", () => {
    const findings = sortFindings([
      buildBrokenLinkFinding({
        id: "broken-a",
        rank: 1,
        linkFromUrl: "https://arngren.net/",
        linkToUrl: "http://www.arngren.net/eltrack-2",
      }),
      buildBrokenLinkFinding({
        id: "broken-b",
        rank: 2,
        linkFromUrl: "https://arngren.net/",
        linkToUrl: "http://www.arngren.net/other-broken",
      }),
    ]);

    const groups = selectHighlightGroups(findings);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.representativeFindingId)).toEqual([
      "broken-a",
      "broken-b",
    ]);
  });

  it("fills the top three slots with distinct groups after grouping", () => {
    const findings = sortFindings([
      buildBrokenLinkFinding({
        id: "broken-1",
        rank: 1,
        linkFromUrl: "https://arngren.net/1",
        linkToUrl: "http://www.arngren.net/eltrack-2",
      }),
      buildBrokenLinkFinding({
        id: "broken-2",
        rank: 2,
        linkFromUrl: "https://arngren.net/2",
        linkToUrl: "http://www.arngren.net/eltrack-2",
      }),
      buildBrokenLinkFinding({
        id: "broken-3",
        rank: 3,
        linkFromUrl: "https://arngren.net/3",
        linkToUrl: "http://www.arngren.net/eltrack-2",
      }),
      buildGenericFinding({
        id: "non-200",
        ruleKey: "indexability.non_200_page",
        rank: 4,
        level: "high",
      }),
      buildGenericFinding({
        id: "canonical",
        ruleKey: "indexability.canonical_missing",
        rank: 5,
        level: "medium",
      }),
    ]);

    const groups = selectHighlightGroups(findings);

    expect(groups).toHaveLength(3);
    expect(groups[0]?.representativeFindingId).toBe("broken-1");
    expect(groups[0]?.rawFindingCount).toBe(3);
    expect(groups[0]?.affectedPageCount).toBe(3);
    expect(groups[1]?.representativeFindingId).toBe("non-200");
    expect(groups[2]?.representativeFindingId).toBe("canonical");
  });

  it("retains existing behavior for non-grouped rule keys", () => {
    const findings = sortFindings([
      buildGenericFinding({
        id: "noindex",
        ruleKey: "indexability.noindex",
        rank: 1,
        level: "critical",
      }),
      buildGenericFinding({
        id: "missing-title",
        ruleKey: "page_fundamentals.missing_title",
        rank: 2,
        level: "high",
      }),
      buildGenericFinding({
        id: "missing-h1",
        ruleKey: "page_fundamentals.missing_h1",
        rank: 3,
        level: "medium",
      }),
      buildGenericFinding({
        id: "extra",
        ruleKey: "page_fundamentals.missing_meta_description",
        rank: 4,
        level: "medium",
      }),
    ]);

    const groups = selectHighlightGroups(findings);

    expect(groups.map((group) => group.representativeFindingId)).toEqual([
      "noindex",
      "missing-title",
      "missing-h1",
    ]);
    expect(groups.every((group) => group.affectedPageCount === 1)).toBe(true);
  });

  it("excludes low findings from highlight groups", () => {
    const findings = sortFindings([
      buildGenericFinding({
        id: "redirect",
        ruleKey: "indexability.redirecting_url",
        rank: 1,
        level: "low",
      }),
      buildGenericFinding({
        id: "high",
        ruleKey: "page_fundamentals.missing_title",
        rank: 2,
        level: "high",
      }),
    ]);

    expect(selectHighlightGroups(findings)).toEqual([
      {
        groupKey: "high",
        representativeFindingId: "high",
        memberFindingIds: ["high"],
        rawFindingCount: 1,
        affectedPageCount: 1,
      },
    ]);
  });

  it("preserves deterministic ordering by rank", () => {
    const findings = sortFindings([
      buildGenericFinding({
        id: "second",
        ruleKey: "page_fundamentals.missing_h1",
        rank: 2,
        level: "medium",
      }),
      buildGenericFinding({
        id: "first",
        ruleKey: "indexability.noindex",
        rank: 1,
        level: "critical",
      }),
    ]);

    expect(
      selectHighlightGroups(findings).map((group) => group.representativeFindingId),
    ).toEqual(["first", "second"]);
  });
});
