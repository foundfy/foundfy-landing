import { describe, expect, it } from "vitest";
import { filterRelatedIdeas } from "./filter";

describe("RESEARCH idea filtering", () => {
  it("drops seed duplicates, brand-only queries, and empty keywords", () => {
    const filtered = filterRelatedIdeas({
      hostname: "dbhobby.com",
      seedOffering: "silk paint",
      ideas: [
        { keyword: "silk paint", searchVolume: 100, providerOrder: 0 },
        { keyword: "dbhobby", searchVolume: 90, providerOrder: 1 },
        { keyword: "", searchVolume: 80, providerOrder: 2 },
        { keyword: "fixture related term", searchVolume: 40, providerOrder: 3 },
      ],
    });
    expect(filtered.map((item) => item.keyword)).toEqual(["fixture related term"]);
  });

  it("dedupes compact keys within a language, prefers higher volume, then lexical tie-break", () => {
    const filtered = filterRelatedIdeas({
      hostname: "example.com",
      seedOffering: "silk paint",
      ideas: [
        { keyword: "fixture related silk", searchVolume: 40, providerOrder: 0 },
        { keyword: "Fixture Related Silk", searchVolume: 80, providerOrder: 1 },
        { keyword: "another fixture term", searchVolume: 80, providerOrder: 2 },
      ],
    });
    expect(filtered.map((item) => item.keyword)).toEqual([
      "another fixture term",
      "Fixture Related Silk",
    ]);
    expect(filtered.some((item) => item.keyword === "fixture related silk")).toBe(false);
  });

  it("preserves diacritics and does not merge distinct compact keys", () => {
    const filtered = filterRelatedIdeas({
      hostname: "example.com",
      seedOffering: "seda",
      ideas: [
        { keyword: "pintura sobre seda", searchVolume: 10, providerOrder: 0 },
        { keyword: "pintura sobre séda", searchVolume: 10, providerOrder: 1 },
      ],
    });
    expect(filtered).toHaveLength(2);
  });

  it("caps retained ideas at 20", () => {
    const filtered = filterRelatedIdeas({
      hostname: "example.com",
      seedOffering: "silk paint",
      ideas: Array.from({ length: 30 }, (_, index) => ({
        keyword: `fixture term ${index}`,
        searchVolume: index,
        providerOrder: index,
      })),
    });
    expect(filtered).toHaveLength(20);
  });
});
