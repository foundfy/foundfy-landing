import { describe, expect, it } from "vitest";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import { sortFindings } from "./order";
import { groupFindingsByAction, selectHighlightGroups } from "./highlight-groups";

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
        groupKey: "page_fundamentals.missing_title",
        representativeFindingId: "high",
        memberFindingIds: ["high"],
        rawFindingCount: 1,
        affectedPageCount: 1,
      },
    ]);
  });

  it("groups the same actionable issue instead of repeating observation rows", () => {
    const findings = sortFindings([
      buildGenericFinding({
        id: "title-1",
        ruleKey: "page_fundamentals.duplicate_title",
        rank: 1,
        level: "high",
      }),
      buildGenericFinding({
        id: "title-2",
        ruleKey: "page_fundamentals.duplicate_title",
        rank: 2,
        level: "high",
      }),
      buildGenericFinding({
        id: "title-3",
        ruleKey: "page_fundamentals.duplicate_title",
        rank: 3,
        level: "high",
      }),
      buildGenericFinding({
        id: "meta-1",
        ruleKey: "page_fundamentals.missing_meta_description",
        rank: 4,
        level: "medium",
      }),
    ]).map((finding, index) => ({
      ...finding,
      pageUrl: `https://example.com/page-${index + 1}`,
      evidence:
        finding.ruleKey === "page_fundamentals.duplicate_title"
          ? { title: "Home" }
          : finding.evidence,
    }));

    const groups = groupFindingsByAction(findings);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.groupKey).toBe("page_fundamentals.duplicate_title:home");
    expect(groups[0]?.affectedPageCount).toBe(3);
    expect(groups[0]?.memberFindingIds).toEqual(["title-1", "title-2", "title-3"]);
    expect(groups[1]?.representativeFindingId).toBe("meta-1");
  });

  it("keeps distinct actions separate even when rule keys match", () => {
    const findings = sortFindings([
      {
        ...buildBrokenLinkFinding({
          id: "broken-a",
          rank: 1,
          linkFromUrl: "https://example.com/a",
          linkToUrl: "https://example.com/dead-1",
        }),
      },
      {
        ...buildBrokenLinkFinding({
          id: "broken-b",
          rank: 2,
          linkFromUrl: "https://example.com/b",
          linkToUrl: "https://example.com/dead-2",
        }),
      },
    ]);

    const groups = groupFindingsByAction(findings);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.groupKey).not.toBe(groups[1]?.groupKey);
  });

  it("collapses a DBHobby-shaped 41-finding set into 7 distinct actions", () => {
    const findings: AnalysisFinding[] = [];
    let rank = 1;

    const pushMany = (
      count: number,
      ruleKey: string,
      level: "critical" | "high" | "medium" | "low",
      evidence: Record<string, unknown> = {},
    ) => {
      for (let index = 0; index < count; index += 1) {
        findings.push({
          ...buildGenericFinding({
            id: `${ruleKey}-${index}`,
            ruleKey,
            rank,
            level,
          }),
          pageUrl: `https://dbhobby.example/page-${rank}`,
          evidence,
        });
        rank += 1;
      }
    };

    pushMany(8, "page_fundamentals.duplicate_title", "high", { title: "Home" });
    pushMany(6, "page_fundamentals.duplicate_meta_description", "high", {
      metaDescription: "Welcome",
    });
    pushMany(10, "page_fundamentals.missing_meta_description", "medium");
    pushMany(5, "page_fundamentals.title_length_out_of_range", "low");
    pushMany(4, "page_fundamentals.missing_h1", "medium");
    pushMany(3, "internal_structure.broken_internal_link", "high", {
      linkToUrl: "https://dbhobby.example/dead",
    });
    pushMany(5, "indexability.canonical_missing", "medium");

    expect(findings).toHaveLength(41);

    const groups = groupFindingsByAction(sortFindings(findings));
    expect(groups).toHaveLength(7);
    expect(groups.reduce((sum, group) => sum + group.rawFindingCount, 0)).toBe(41);
  });

  it("merges canonical-elsewhere findings that share one human destination", () => {
    const findings = sortFindings([
      {
        ...buildGenericFinding({
          id: "canonical-home",
          ruleKey: "indexability.canonical_points_elsewhere",
          rank: 1,
          level: "medium",
        }),
        pageUrl: "https://dbhobby.com/",
        evidence: { canonical: "https://www.dbhobby.com/ca/pintura-en-seda" },
      },
      {
        ...buildGenericFinding({
          id: "canonical-ca",
          ruleKey: "indexability.canonical_points_elsewhere",
          rank: 2,
          level: "medium",
        }),
        pageUrl: "https://www.dbhobby.com/ca",
        evidence: { canonical: "https://dbhobby.com/ca/pintura-en-seda" },
      },
    ]);

    const groups = groupFindingsByAction(findings);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.memberFindingIds).toEqual(["canonical-home", "canonical-ca"]);
    expect(groups[0]?.affectedPageCount).toBe(2);
    expect(groups[0]?.rawFindingCount).toBe(2);
  });

  it("keeps canonical remediations separate when destinations differ", () => {
    const findings = sortFindings([
      {
        ...buildGenericFinding({
          id: "canonical-a",
          ruleKey: "indexability.canonical_points_elsewhere",
          rank: 1,
          level: "medium",
        }),
        pageUrl: "https://example.com/a",
        evidence: { canonical: "https://example.com/product-a" },
      },
      {
        ...buildGenericFinding({
          id: "canonical-b",
          ruleKey: "indexability.canonical_points_elsewhere",
          rank: 2,
          level: "medium",
        }),
        pageUrl: "https://example.com/b",
        evidence: { canonical: "https://example.com/product-b" },
      },
    ]);

    const groups = groupFindingsByAction(findings);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.groupKey).not.toBe(groups[1]?.groupKey);
  });

  it("does not merge canonical-elsewhere with canonical-missing", () => {
    const findings = sortFindings([
      {
        ...buildGenericFinding({
          id: "elsewhere",
          ruleKey: "indexability.canonical_points_elsewhere",
          rank: 1,
          level: "medium",
        }),
        pageUrl: "https://example.com/",
        evidence: { canonical: "https://example.com/product" },
      },
      {
        ...buildGenericFinding({
          id: "missing",
          ruleKey: "indexability.canonical_missing",
          rank: 2,
          level: "medium",
        }),
        pageUrl: "https://example.com/cart",
        evidence: { canonical: null },
      },
    ]);

    const groups = groupFindingsByAction(findings);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.representativeFindingId)).toEqual([
      "elsewhere",
      "missing",
    ]);
  });

  it("merges title-length into a duplicate-title cluster only when the title matches", () => {
    const findings = sortFindings([
      {
        ...buildGenericFinding({
          id: "dup-1",
          ruleKey: "page_fundamentals.duplicate_title",
          rank: 1,
          level: "high",
        }),
        pageUrl: "https://example.com/",
        evidence: { title: "Pintura sobre seda | DBHOBBY" },
      },
      {
        ...buildGenericFinding({
          id: "dup-2",
          ruleKey: "page_fundamentals.duplicate_title",
          rank: 2,
          level: "high",
        }),
        pageUrl: "https://example.com/ca",
        evidence: { title: "Pintura sobre seda | DBHOBBY" },
      },
      {
        ...buildGenericFinding({
          id: "length-match",
          ruleKey: "page_fundamentals.title_length_out_of_range",
          rank: 3,
          level: "low",
        }),
        pageUrl: "https://example.com/",
        evidence: { title: "Pintura sobre seda | DBHOBBY", titleLength: 28 },
      },
      {
        ...buildGenericFinding({
          id: "length-other",
          ruleKey: "page_fundamentals.title_length_out_of_range",
          rank: 4,
          level: "low",
        }),
        pageUrl: "https://example.com/login",
        evidence: { title: "Entra | DBHOBBY", titleLength: 15 },
      },
    ]);

    const groups = groupFindingsByAction(findings);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.groupKey).toBe(
      "page_fundamentals.duplicate_title:pintura sobre seda | dbhobby",
    );
    expect(groups[0]?.memberFindingIds).toEqual(["dup-1", "dup-2", "length-match"]);
    expect(groups[0]?.affectedPageCount).toBe(2);
    expect(groups[1]?.groupKey).toBe("page_fundamentals.title_length_out_of_range");
    expect(groups[1]?.memberFindingIds).toEqual(["length-other"]);
  });

  it("keeps two different shared-title clusters as separate title jobs", () => {
    const findings = sortFindings([
      {
        ...buildGenericFinding({
          id: "cluster-a",
          ruleKey: "page_fundamentals.duplicate_title",
          rank: 1,
          level: "high",
        }),
        pageUrl: "https://example.com/",
        evidence: { title: "Pintura sobre seda | DBHOBBY" },
      },
      {
        ...buildGenericFinding({
          id: "cluster-b",
          ruleKey: "page_fundamentals.duplicate_title",
          rank: 2,
          level: "medium",
        }),
        pageUrl: "https://example.com/product",
        evidence: { title: "DBHOBBY | Pintura sobre seda" },
      },
      {
        ...buildGenericFinding({
          id: "length-b",
          ruleKey: "page_fundamentals.title_length_out_of_range",
          rank: 3,
          level: "low",
        }),
        pageUrl: "https://example.com/product",
        evidence: { title: "DBHOBBY | Pintura sobre seda", titleLength: 28 },
      },
    ]);

    const groups = groupFindingsByAction(findings);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.memberFindingIds).toEqual(["cluster-a"]);
    expect(groups[1]?.memberFindingIds).toEqual(["cluster-b", "length-b"]);
  });

  it("keeps member evidence and page URLs after human-action merges", () => {
    const findings = sortFindings([
      {
        ...buildGenericFinding({
          id: "canonical-home",
          ruleKey: "indexability.canonical_points_elsewhere",
          rank: 1,
          level: "medium",
        }),
        pageUrl: "https://dbhobby.com/",
        evidence: { canonical: "https://www.dbhobby.com/silk" },
      },
      {
        ...buildGenericFinding({
          id: "canonical-ca",
          ruleKey: "indexability.canonical_points_elsewhere",
          rank: 2,
          level: "medium",
        }),
        pageUrl: "https://www.dbhobby.com/ca",
        evidence: { canonical: "https://dbhobby.com/silk" },
      },
    ]);

    const groups = groupFindingsByAction(findings);
    expect(groups[0]?.memberFindingIds).toEqual(["canonical-home", "canonical-ca"]);
    expect(findings.find((finding) => finding.id === "canonical-ca")?.pageUrl).toBe(
      "https://www.dbhobby.com/ca",
    );
    expect(findings.find((finding) => finding.id === "canonical-ca")?.evidence.canonical).toBe(
      "https://dbhobby.com/silk",
    );
  });

  it("uses merged human actions for distinct highlights so canonical cannot occupy two slots", () => {
    const findings = sortFindings([
      {
        ...buildGenericFinding({
          id: "title-1",
          ruleKey: "page_fundamentals.duplicate_title",
          rank: 1,
          level: "high",
        }),
        pageUrl: "https://example.com/",
        evidence: { title: "Shared A" },
      },
      {
        ...buildGenericFinding({
          id: "canonical-home",
          ruleKey: "indexability.canonical_points_elsewhere",
          rank: 2,
          level: "medium",
        }),
        pageUrl: "https://example.com/",
        evidence: { canonical: "https://www.example.com/product" },
      },
      {
        ...buildGenericFinding({
          id: "canonical-alt",
          ruleKey: "indexability.canonical_points_elsewhere",
          rank: 3,
          level: "medium",
        }),
        pageUrl: "https://www.example.com/ca",
        evidence: { canonical: "https://example.com/product" },
      },
      {
        ...buildGenericFinding({
          id: "title-2",
          ruleKey: "page_fundamentals.duplicate_title",
          rank: 4,
          level: "medium",
        }),
        pageUrl: "https://example.com/b",
        evidence: { title: "Shared B" },
      },
      {
        ...buildGenericFinding({
          id: "missing-h1",
          ruleKey: "page_fundamentals.missing_h1",
          rank: 5,
          level: "medium",
        }),
        pageUrl: "https://example.com/c",
      },
    ]);

    const groups = selectHighlightGroups(findings);
    expect(groups).toHaveLength(3);
    expect(groups.map((group) => group.representativeFindingId)).toEqual([
      "title-1",
      "canonical-home",
      "title-2",
    ]);
    expect(groups[1]?.memberFindingIds).toEqual(["canonical-home", "canonical-alt"]);
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
