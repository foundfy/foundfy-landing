import { describe, expect, it } from "vitest";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import { sortFindings } from "./order";

function buildFinding(input: {
  id: string;
  rank?: number;
  severity?: "info" | "warning" | "error";
}): AnalysisFinding {
  return {
    id: input.id,
    ruleKey: "indexability.redirecting_url",
    category: "indexability",
    severity: input.severity ?? "info",
    title: "Finding",
    description: "Description",
    pageUrl: null,
    evidence: {},
    priority:
      input.rank === undefined
        ? null
        : {
            level: "medium",
            rank: input.rank,
            whyItMatters: "Why",
            recommendedAction: "Action",
            verification: null,
          },
  };
}

describe("sortFindings", () => {
  it("orders prioritised findings before unprioritised findings", () => {
    const sorted = sortFindings([
      buildFinding({ id: "unknown", severity: "error" }),
      buildFinding({ id: "ranked", rank: 2 }),
      buildFinding({ id: "ranked-first", rank: 1 }),
    ]);

    expect(sorted.map((finding) => finding.id)).toEqual([
      "ranked-first",
      "ranked",
      "unknown",
    ]);
  });
});
