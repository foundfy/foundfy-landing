import { describe, expect, it } from "vitest";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import {
  HIGHLIGHT_MAX_COUNT,
  selectHighlightedFindingIds,
} from "./select-highlights";

function buildFinding(input: {
  id: string;
  level: "critical" | "high" | "medium" | "low" | null;
  rank: number;
  ruleKey?: string;
}): AnalysisFinding {
  return {
    id: input.id,
    ruleKey: input.ruleKey ?? "page_fundamentals.missing_title",
    category: "page_fundamentals",
    severity: "warning",
    title: "Finding",
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

describe("selectHighlightedFindingIds", () => {
  it("includes critical, high, and medium findings up to the cap", () => {
    const findings = [
      buildFinding({
        id: "critical-1",
        level: "critical",
        rank: 1,
        ruleKey: "indexability.noindex",
      }),
      buildFinding({
        id: "high-1",
        level: "high",
        rank: 2,
        ruleKey: "page_fundamentals.missing_title",
      }),
      buildFinding({
        id: "medium-1",
        level: "medium",
        rank: 3,
        ruleKey: "page_fundamentals.missing_h1",
      }),
      buildFinding({
        id: "medium-2",
        level: "medium",
        rank: 4,
        ruleKey: "page_fundamentals.missing_meta_description",
      }),
      buildFinding({
        id: "low-1",
        level: "low",
        rank: 5,
        ruleKey: "indexability.redirecting_url",
      }),
    ];

    expect(selectHighlightedFindingIds(findings)).toEqual([
      "critical-1",
      "high-1",
      "medium-1",
    ]);
    expect(HIGHLIGHT_MAX_COUNT).toBe(3);
  });

  it("uses one highlight slot for the same action", () => {
    const findings = [
      buildFinding({ id: "title-1", level: "high", rank: 1 }),
      buildFinding({ id: "title-2", level: "high", rank: 2 }),
      buildFinding({ id: "title-3", level: "medium", rank: 3 }),
    ];

    expect(selectHighlightedFindingIds(findings)).toEqual(["title-1"]);
  });

  it("excludes low findings and unprioritised findings", () => {
    const findings = [
      buildFinding({ id: "low-redirect", level: "low", rank: 1 }),
      buildFinding({ id: "unknown", level: null, rank: 2 }),
    ];

    expect(selectHighlightedFindingIds(findings)).toEqual([]);
  });

  it("does not pad highlights when fewer than three qualify", () => {
    const findings = [
      buildFinding({ id: "high-1", level: "high", rank: 1 }),
      buildFinding({ id: "low-1", level: "low", rank: 2 }),
    ];

    expect(selectHighlightedFindingIds(findings)).toEqual(["high-1"]);
  });
});
