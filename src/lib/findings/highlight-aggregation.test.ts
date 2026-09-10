import { describe, expect, it } from "vitest";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import {
  collectNormalizedAffectedSourceUrls,
  computeBrokenLinkAffectedPageCount,
} from "./highlight-aggregation";

function buildBrokenLinkFinding(input: {
  id: string;
  pageUrl: string;
}): AnalysisFinding {
  return {
    id: input.id,
    ruleKey: "internal_structure.broken_internal_link",
    category: "internal_structure",
    severity: "warning",
    title: "Broken internal link to crawled page",
    description: "Description",
    pageUrl: input.pageUrl,
    evidence: {
      linkToUrl: "http://www.arngren.net/eltrack-2",
      targetStatusCode: 404,
    },
    priority: {
      level: "high",
      rank: 1,
      whyItMatters: "Why",
      recommendedAction: "Action",
      verification: null,
    },
  };
}

describe("broken-link affected page counting", () => {
  it("counts unique normalized source URLs rather than raw findings", () => {
    const members = [
      buildBrokenLinkFinding({ id: "broken-1", pageUrl: "http://arngren.net/" }),
      buildBrokenLinkFinding({ id: "broken-2", pageUrl: "http://arngren.net/" }),
      buildBrokenLinkFinding({ id: "broken-3", pageUrl: "https://arngren.net/" }),
      buildBrokenLinkFinding({ id: "broken-4", pageUrl: "https://arngren.net/" }),
    ];

    expect(collectNormalizedAffectedSourceUrls(members)).toEqual([
      "http://arngren.net/",
      "https://arngren.net/",
    ]);
    expect(computeBrokenLinkAffectedPageCount(members)).toBe(2);
    expect(members).toHaveLength(4);
  });
});
