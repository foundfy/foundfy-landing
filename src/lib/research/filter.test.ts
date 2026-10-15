import { describe, expect, it } from "vitest";
import { filterRelatedIdeas, type ProviderIdeaRow } from "./filter";
import {
  emptyFilterReasonCounts,
  filterReasonCountSum,
  type ResearchFilterReasonCounts,
} from "./filter-reasons";
import { isClearlyBrandedQuery, opportunityCompactKey } from "@/lib/opportunities/normalize";
import { hasDisallowedOfferingCharacters } from "./offerings";
import { RESEARCH_MAX_IDEAS_PER_REQUEST } from "./config";

function zeros(overrides: Partial<ResearchFilterReasonCounts> = {}): ResearchFilterReasonCounts {
  return { ...emptyFilterReasonCounts(), ...overrides };
}

function legacyFilterRelatedIdeas(input: {
  ideas: ProviderIdeaRow[];
  seedOffering: string;
  hostname: string;
  limit?: number;
}): ProviderIdeaRow[] {
  const seedCompact = opportunityCompactKey(input.seedOffering);
  const byCompact = new Map<string, ProviderIdeaRow>();

  function compareIdeas(left: ProviderIdeaRow, right: ProviderIdeaRow): number {
    const leftVolume = left.searchVolume;
    const rightVolume = right.searchVolume;
    if (leftVolume != null && rightVolume != null && leftVolume !== rightVolume) {
      return rightVolume - leftVolume;
    }
    if (leftVolume != null && rightVolume == null) {
      return -1;
    }
    if (leftVolume == null && rightVolume != null) {
      return 1;
    }
    const lexical = left.keyword.localeCompare(right.keyword, "en");
    if (lexical !== 0) {
      return lexical;
    }
    return left.providerOrder - right.providerOrder;
  }

  for (const idea of input.ideas) {
    const keyword = idea.keyword.trim().replace(/\s+/g, " ");
    if (!keyword) {
      continue;
    }
    if (hasDisallowedOfferingCharacters(keyword)) {
      continue;
    }
    if (isClearlyBrandedQuery(keyword, input.hostname)) {
      continue;
    }
    const compact = opportunityCompactKey(keyword);
    if (!compact || compact === seedCompact) {
      continue;
    }
    const candidate: ProviderIdeaRow = {
      keyword,
      searchVolume: idea.searchVolume,
      providerOrder: idea.providerOrder,
    };
    const existing = byCompact.get(compact);
    if (!existing || compareIdeas(candidate, existing) < 0) {
      byCompact.set(compact, candidate);
    }
  }

  return [...byCompact.values()]
    .sort(compareIdeas)
    .slice(0, input.limit ?? RESEARCH_MAX_IDEAS_PER_REQUEST);
}

function expectAccounting(
  ideas: ProviderIdeaRow[],
  result: ReturnType<typeof filterRelatedIdeas>,
): void {
  expect(result.ideas.length + filterReasonCountSum(result.filterReasonCounts)).toBe(ideas.length);
}

describe("RESEARCH idea filtering", () => {
  it("drops seed duplicates, brand-only queries, and empty keywords", () => {
    const input = {
      hostname: "dbhobby.com",
      seedOffering: "silk paint",
      ideas: [
        { keyword: "silk paint", searchVolume: 100, providerOrder: 0 },
        { keyword: "dbhobby", searchVolume: 90, providerOrder: 1 },
        { keyword: "", searchVolume: 80, providerOrder: 2 },
        { keyword: "fixture related term", searchVolume: 40, providerOrder: 3 },
      ],
    };
    const filtered = filterRelatedIdeas(input);
    expect(filtered.ideas.map((item) => item.keyword)).toEqual(["fixture related term"]);
    expect(filtered.ideas).toEqual(legacyFilterRelatedIdeas(input));
    expect(filtered.filterReasonCounts).toEqual(
      zeros({ seedDuplicateCount: 1, brandOnlyCount: 1, emptyCount: 1 }),
    );
    expectAccounting(input.ideas, filtered);
  });

  it("dedupes compact keys within a language, prefers higher volume, then lexical tie-break", () => {
    const input = {
      hostname: "example.com",
      seedOffering: "silk paint",
      ideas: [
        { keyword: "fixture related silk", searchVolume: 40, providerOrder: 0 },
        { keyword: "Fixture Related Silk", searchVolume: 80, providerOrder: 1 },
        { keyword: "another fixture term", searchVolume: 80, providerOrder: 2 },
      ],
    };
    const filtered = filterRelatedIdeas(input);
    expect(filtered.ideas.map((item) => item.keyword)).toEqual([
      "another fixture term",
      "Fixture Related Silk",
    ]);
    expect(filtered.ideas.some((item) => item.keyword === "fixture related silk")).toBe(false);
    expect(filtered.ideas).toEqual(legacyFilterRelatedIdeas(input));
    expect(filtered.filterReasonCounts).toEqual(zeros({ compactDuplicateCount: 1 }));
    expectAccounting(input.ideas, filtered);
  });

  it("preserves diacritics and does not merge distinct compact keys", () => {
    const input = {
      hostname: "example.com",
      seedOffering: "seda",
      ideas: [
        { keyword: "pintura sobre seda", searchVolume: 10, providerOrder: 0 },
        { keyword: "pintura sobre séda", searchVolume: 10, providerOrder: 1 },
      ],
    };
    const filtered = filterRelatedIdeas(input);
    expect(filtered.ideas).toHaveLength(2);
    expect(filtered.ideas).toEqual(legacyFilterRelatedIdeas(input));
    expect(filtered.filterReasonCounts).toEqual(zeros());
    expectAccounting(input.ideas, filtered);
  });

  it("caps retained ideas at 20", () => {
    const ideas = Array.from({ length: 30 }, (_, index) => ({
      keyword: `fixture term ${index}`,
      searchVolume: index,
      providerOrder: index,
    }));
    const input = { hostname: "example.com", seedOffering: "silk paint", ideas };
    const filtered = filterRelatedIdeas(input);
    expect(filtered.ideas).toHaveLength(20);
    expect(filtered.ideas).toEqual(legacyFilterRelatedIdeas(input));
    expect(filtered.filterReasonCounts).toEqual(zeros({ cappedCount: 10 }));
    expectAccounting(ideas, filtered);
  });

  it("keeps all valid unique rows with zero reason counts", () => {
    const ideas = [
      { keyword: "como pintar en seda", searchVolume: 20, providerOrder: 0 },
      { keyword: "pintura seda", searchVolume: 10, providerOrder: 1 },
      { keyword: "gutta resist", searchVolume: 5, providerOrder: 2 },
    ];
    const filtered = filterRelatedIdeas({
      hostname: "dbhobby.com",
      seedOffering: "Materiales para pintura sobre seda",
      ideas,
    });
    expect(filtered.ideas.map((item) => item.keyword)).toEqual([
      "como pintar en seda",
      "pintura seda",
      "gutta resist",
    ]);
    expect(filtered.filterReasonCounts).toEqual(zeros());
    expectAccounting(ideas, filtered);
  });

  it("counts exact seed compact matches as seed duplicates", () => {
    const ideas = [{ keyword: "Materiales para pintura sobre seda", searchVolume: 40, providerOrder: 0 }];
    const filtered = filterRelatedIdeas({
      hostname: "dbhobby.com",
      seedOffering: "Materiales para pintura sobre seda",
      ideas,
    });
    expect(filtered.ideas).toEqual([]);
    expect(filtered.filterReasonCounts).toEqual(zeros({ seedDuplicateCount: 1 }));
    expectAccounting(ideas, filtered);
  });

  it("counts whitespace-only rows as empty, not seed duplicates", () => {
    const ideas = [{ keyword: "   ", searchVolume: 10, providerOrder: 0 }];
    const filtered = filterRelatedIdeas({
      hostname: "example.com",
      seedOffering: "silk paint",
      ideas,
    });
    expect(filtered.ideas).toEqual([]);
    expect(filtered.filterReasonCounts).toEqual(zeros({ emptyCount: 1 }));
    expect(filtered.filterReasonCounts.seedDuplicateCount).toBe(0);
    expectAccounting(ideas, filtered);
  });

  it("counts non-empty punctuation-only compact keys as empty, not seed duplicates", () => {
    const ideas = [{ keyword: "... --- ???", searchVolume: 12, providerOrder: 0 }];
    const filtered = filterRelatedIdeas({
      hostname: "example.com",
      seedOffering: "silk paint",
      ideas,
    });
    expect(ideas[0]?.keyword.trim()).toBe("... --- ???");
    expect(opportunityCompactKey(ideas[0]!.keyword)).toBe("");
    expect(filtered.ideas).toEqual([]);
    expect(filtered.filterReasonCounts).toEqual(zeros({ emptyCount: 1 }));
    expect(filtered.filterReasonCounts.seedDuplicateCount).toBe(0);
    expectAccounting(ideas, filtered);
  });

  it("counts unsupported characters as invalid", () => {
    const ideas = [{ keyword: "silk paint \u{1F3A8}", searchVolume: 15, providerOrder: 0 }];
    const filtered = filterRelatedIdeas({
      hostname: "example.com",
      seedOffering: "gutta resist",
      ideas,
    });
    expect(filtered.ideas).toEqual([]);
    expect(filtered.filterReasonCounts).toEqual(zeros({ invalidCount: 1 }));
    expectAccounting(ideas, filtered);
  });

  it("counts brand-only rows separately from other reasons", () => {
    const ideas = [{ keyword: "dbhobby", searchVolume: 90, providerOrder: 0 }];
    const filtered = filterRelatedIdeas({
      hostname: "dbhobby.com",
      seedOffering: "silk paint",
      ideas,
    });
    expect(filtered.ideas).toEqual([]);
    expect(filtered.filterReasonCounts).toEqual(zeros({ brandOnlyCount: 1 }));
    expectAccounting(ideas, filtered);
  });

  it("counts N-1 compact duplicates and replaces with the preferred later candidate", () => {
    const ideas = [
      { keyword: "fixture related silk", searchVolume: 40, providerOrder: 0 },
      { keyword: "Fixture Related Silk", searchVolume: 80, providerOrder: 1 },
    ];
    const input = { hostname: "example.com", seedOffering: "silk paint", ideas };
    const filtered = filterRelatedIdeas(input);
    expect(filtered.ideas.map((item) => item.keyword)).toEqual(["Fixture Related Silk"]);
    expect(filtered.ideas).toEqual(legacyFilterRelatedIdeas(input));
    expect(filtered.filterReasonCounts).toEqual(zeros({ compactDuplicateCount: 1 }));
    expectAccounting(ideas, filtered);
  });

  it("does not count both the displaced and replacing compact-duplicate candidate as discarded", () => {
    const ideas = [
      { keyword: "como pintar en seda", searchVolume: 10, providerOrder: 0 },
      { keyword: "Como pintar en seda", searchVolume: 20, providerOrder: 1 },
      { keyword: "COMO PINTAR EN SEDA", searchVolume: 20, providerOrder: 2 },
    ];
    const filtered = filterRelatedIdeas({
      hostname: "dbhobby.com",
      seedOffering: "Materiales para pintura sobre seda",
      ideas,
    });
    expect(filtered.ideas).toHaveLength(1);
    expect(filtered.filterReasonCounts.compactDuplicateCount).toBe(2);
    expectAccounting(ideas, filtered);
  });

  it("assigns mixed terminal dispositions without double-counting", () => {
    const ideas = [
      { keyword: "   ", searchVolume: 1, providerOrder: 0 },
      { keyword: "...", searchVolume: 1, providerOrder: 1 },
      { keyword: "silk \u{1F3A8}", searchVolume: 1, providerOrder: 2 },
      { keyword: "dbhobby", searchVolume: 1, providerOrder: 3 },
      { keyword: "silk paint", searchVolume: 1, providerOrder: 4 },
      { keyword: "fixture related silk", searchVolume: 10, providerOrder: 5 },
      { keyword: "Fixture Related Silk", searchVolume: 20, providerOrder: 6 },
      { keyword: "kept unique term", searchVolume: 5, providerOrder: 7 },
    ];
    const filtered = filterRelatedIdeas({
      hostname: "dbhobby.com",
      seedOffering: "silk paint",
      ideas,
    });
    expect(filtered.ideas.map((item) => item.keyword)).toEqual([
      "Fixture Related Silk",
      "kept unique term",
    ]);
    expect(filtered.filterReasonCounts).toEqual({
      emptyCount: 2,
      invalidCount: 1,
      brandOnlyCount: 1,
      seedDuplicateCount: 1,
      compactDuplicateCount: 1,
      cappedCount: 0,
    });
    expectAccounting(ideas, filtered);
  });

  it("reconciles kept ideas plus reason counts to provider row count for every fixture", () => {
    const fixtures: Array<{
      hostname: string;
      seedOffering: string;
      ideas: ProviderIdeaRow[];
    }> = [
      { hostname: "example.com", seedOffering: "silk paint", ideas: [] },
      {
        hostname: "dbhobby.com",
        seedOffering: "Materiales para pintura sobre seda",
        ideas: [
          { keyword: "como pintar en seda", searchVolume: 20, providerOrder: 0 },
          { keyword: "Materiales para pintura sobre seda", searchVolume: 10, providerOrder: 1 },
          { keyword: "dbhobby", searchVolume: 5, providerOrder: 2 },
        ],
      },
    ];
    for (const fixture of fixtures) {
      const filtered = filterRelatedIdeas(fixture);
      expect(filtered.ideas).toEqual(legacyFilterRelatedIdeas(fixture));
      expectAccounting(fixture.ideas, filtered);
    }
  });
});
