import { describe, expect, it } from "vitest";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import { sortFindings } from "./order";
import { selectHighlightedFindingIds } from "./select-highlights";

function buildFinding(input: {
  id: string;
  ruleKey: string;
  level: "critical" | "high" | "medium" | "low" | null;
  rank: number;
}): AnalysisFinding {
  return {
    id: input.id,
    ruleKey: input.ruleKey,
    category: "indexability",
    severity: "warning",
    title: input.ruleKey,
    description: "Description",
    pageUrl: null,
    evidence: {},
    priority:
      input.level === null
        ? null
        : {
            level: input.level,
            rank: input.rank,
            whyItMatters: "Why",
            recommendedAction: "Action",
            verification: null,
          },
  };
}

describe("highlight scenarios", () => {
  it("keeps a one-page redirect out of What matters first", () => {
    const findings = sortFindings([
      buildFinding({
        id: "redirect",
        ruleKey: "indexability.redirecting_url",
        level: "low",
        rank: 1,
      }),
    ]);

    expect(selectHighlightedFindingIds(findings)).toEqual([]);
  });

  it("ranks missing title above redirect in All findings and highlights title only", () => {
    const findings = sortFindings([
      buildFinding({
        id: "redirect",
        ruleKey: "indexability.redirecting_url",
        level: "low",
        rank: 2,
      }),
      buildFinding({
        id: "title",
        ruleKey: "page_fundamentals.missing_title",
        level: "medium",
        rank: 1,
      }),
    ]);

    expect(findings.map((finding) => finding.id)).toEqual(["title", "redirect"]);
    expect(selectHighlightedFindingIds(findings)).toEqual(["title"]);
  });

  it("keeps noindex unrestricted and in the top three highlights", () => {
    const findings = sortFindings([
      buildFinding({
        id: "redirect",
        ruleKey: "indexability.redirecting_url",
        level: "low",
        rank: 4,
      }),
      buildFinding({
        id: "title-length",
        ruleKey: "page_fundamentals.title_length_out_of_range",
        level: "low",
        rank: 3,
      }),
      buildFinding({
        id: "missing-title",
        ruleKey: "page_fundamentals.missing_title",
        level: "high",
        rank: 2,
      }),
      buildFinding({
        id: "noindex",
        ruleKey: "indexability.noindex",
        level: "critical",
        rank: 1,
      }),
    ]);

    expect(selectHighlightedFindingIds(findings)).toEqual([
      "noindex",
      "missing-title",
    ]);
    expect(findings[0]?.ruleKey).toBe("indexability.noindex");
  });

  it("includes site-wide serious issues in highlights", () => {
    const findings = sortFindings([
      buildFinding({
        id: "robots",
        ruleKey: "site_discovery.robots_txt_missing",
        level: "critical",
        rank: 1,
      }),
      buildFinding({
        id: "redirect",
        ruleKey: "indexability.redirecting_url",
        level: "low",
        rank: 2,
      }),
    ]);

    expect(selectHighlightedFindingIds(findings)).toEqual(["robots"]);
  });
});
