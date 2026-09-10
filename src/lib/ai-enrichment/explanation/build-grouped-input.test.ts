import { describe, expect, it } from "vitest";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import { buildExplanationInputHash } from "./build-input";
import { buildGroupedExplanationInputFinding } from "./build-grouped-input";

function buildBrokenLinkFinding(input: {
  id: string;
  linkFromUrl: string;
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
      fromPageId: `page-${input.id}`,
      linkToUrl: "http://www.arngren.net/eltrack-2",
      targetStatusCode: 404,
      anchorText: "Elektriske Biler",
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

describe("buildGroupedExplanationInputFinding", () => {
  it("builds aggregate evidence from grouped broken-link findings only", () => {
    const representative = buildBrokenLinkFinding({
      id: "broken-1",
      linkFromUrl: "https://arngren.net/",
    });
    const members = [
      representative,
      buildBrokenLinkFinding({
        id: "broken-2",
        linkFromUrl: "https://arngren.net/page-2",
      }),
      buildBrokenLinkFinding({
        id: "broken-3",
        linkFromUrl: "https://arngren.net/page-3",
      }),
    ];

    const input = buildGroupedExplanationInputFinding(representative, members);

    expect(input.findingId).toBe("broken-1");
    expect(input.whitelistedEvidence).toEqual({
      linkToUrl: "http://www.arngren.net/eltrack-2",
      targetStatusCode: 404,
      anchorText: "Elektriske Biler",
      affectedPageCount: 3,
      affectedSourceUrls: [
        "https://arngren.net/",
        "https://arngren.net/page-2",
        "https://arngren.net/page-3",
      ],
    });
  });

  it("uses unique source URL count for affectedPageCount", () => {
    const representative = buildBrokenLinkFinding({
      id: "broken-1",
      linkFromUrl: "http://arngren.net/",
    });
    const members = [
      representative,
      buildBrokenLinkFinding({ id: "broken-2", linkFromUrl: "http://arngren.net/" }),
      buildBrokenLinkFinding({ id: "broken-3", linkFromUrl: "https://arngren.net/" }),
      buildBrokenLinkFinding({ id: "broken-4", linkFromUrl: "https://arngren.net/" }),
    ];

    const input = buildGroupedExplanationInputFinding(representative, members);

    expect(input.whitelistedEvidence.affectedPageCount).toBe(2);
    expect(input.whitelistedEvidence.affectedSourceUrls).toEqual([
      "http://arngren.net/",
      "https://arngren.net/",
    ]);
  });

  it("changes the input hash when grouped evidence changes", () => {
    const representative = buildBrokenLinkFinding({
      id: "broken-1",
      linkFromUrl: "https://arngren.net/",
    });
    const twoMembers = [
      representative,
      buildBrokenLinkFinding({
        id: "broken-2",
        linkFromUrl: "https://arngren.net/page-2",
      }),
    ];
    const threeMembers = [
      ...twoMembers,
      buildBrokenLinkFinding({
        id: "broken-3",
        linkFromUrl: "https://arngren.net/page-3",
      }),
    ];

    const twoMemberHash = buildExplanationInputHash({
      hostname: "arngren.net",
      pagesCrawled: 10,
      finding: representative,
      highlightGroup: {
        representativeFindingId: "broken-1",
        memberFindingIds: ["broken-1", "broken-2"],
        rawFindingCount: 2,
        affectedPageCount: 2,
      },
      findingsById: new Map(twoMembers.map((finding) => [finding.id, finding])),
    });

    const threeMemberHash = buildExplanationInputHash({
      hostname: "arngren.net",
      pagesCrawled: 10,
      finding: representative,
      highlightGroup: {
        representativeFindingId: "broken-1",
        memberFindingIds: ["broken-1", "broken-2", "broken-3"],
        rawFindingCount: 3,
        affectedPageCount: 3,
      },
      findingsById: new Map(threeMembers.map((finding) => [finding.id, finding])),
    });

    expect(twoMemberHash).not.toBe(threeMemberHash);
  });
});
