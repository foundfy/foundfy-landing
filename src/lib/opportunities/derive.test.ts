import { describe, expect, it } from "vitest";
import { deriveQueryOpportunities, impressionWeightedPosition } from "./derive";
import { opportunityCompactKey } from "./normalize";

const CIANO_PAGE = "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo";
const DROPPER_PAGE = "https://dbhobby.com/ca/pintura-seda/compte-gotes";
const DROPPER_HOLDER_PAGE = "https://dbhobby.com/ca/pintura-seda/porta-gobelets-compte-gotes";
const GLASS_DROPPER_PAGE = "https://dbhobby.com/ca/pintura-seda/compte-gotes-de-vidre";
const ALGINATE_ES = "https://www.dbhobby.com/es/pintura-seda/alginato-de-sodio-250";
const ALGINATE_CA = "https://www.dbhobby.com/ca/pintura-seda/alginat-de-sodi-250";

describe("Opportunity Discovery derivation", () => {
  it("includes a meaningful query with a leading existing page", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [
        { query: "cianotipo", clicks: 0, impressions: 187, position: 2.82352941176471 },
        { query: "noise", clicks: 0, impressions: 1, position: 40 },
      ],
      queryPages: [
        {
          query: "cianotipo",
          pageUrl: CIANO_PAGE,
          pageId: null,
          impressions: 186,
        },
        {
          query: "cianotipo",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
          pageId: null,
          impressions: 1,
        },
      ],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      query: "cianotipo",
      appearances: 187,
      visits: 0,
      leadingPageUrl: CIANO_PAGE,
      mapped: false,
    });
    expect(cards[0]?.position).toBeCloseTo(2.8235, 3);
    expect(JSON.stringify(cards)).not.toMatch(/99\.5|% of|share of|visibility goes/i);
  });

  it("excludes a low-evidence query under the existing visibility philosophy", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [
        { query: "cianotipo", clicks: 0, impressions: 187, position: 2.8 },
        { query: "dupion", clicks: 0, impressions: 8, position: 6.3 },
      ],
      queryPages: [
        { query: "cianotipo", pageUrl: CIANO_PAGE, pageId: null, impressions: 187 },
        {
          query: "dupion",
          pageUrl: "https://www.dbhobby.com/es/seda/dupion",
          pageId: null,
          impressions: 8,
        },
      ],
    });

    expect(cards.map((card) => card.query)).toEqual(["cianotipo"]);
  });

  it("lets a clicked query qualify even below the impression share", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [
        { query: "cianotipo", clicks: 0, impressions: 187, position: 2.8 },
        { query: "essence f", clicks: 1, impressions: 15, position: 4.5 },
      ],
      queryPages: [
        { query: "cianotipo", pageUrl: CIANO_PAGE, pageId: null, impressions: 187 },
        {
          query: "essence f",
          pageUrl: "https://dbhobby.com/es/pintura-seda/disolvente-essence-f-250",
          pageId: null,
          impressions: 15,
        },
      ],
    });

    expect(cards.map((card) => card.query)).toEqual(["cianotipo", "essence f"]);
  });

  it("excludes clearly branded hostname queries including spaced tokens", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [
        { query: "dbhobby", clicks: 3, impressions: 41, position: 5.4 },
        { query: "db hobby", clicks: 8, impressions: 18, position: 2.2 },
        { query: "db hobbies", clicks: 2, impressions: 20, position: 5 },
        { query: "dbhobbies", clicks: 1, impressions: 19, position: 6 },
        { query: "dbhobby's", clicks: 1, impressions: 19, position: 4 },
        { query: "cianotipo", clicks: 0, impressions: 187, position: 2.8 },
      ],
      queryPages: [
        {
          query: "dbhobby",
          pageUrl: "https://www.dbhobby.com/ca/taxonomy/term/358",
          pageId: null,
          impressions: 17,
        },
        { query: "db hobby", pageUrl: "https://dbhobby.com/es/login", pageId: null, impressions: 12 },
        {
          query: "db hobbies",
          pageUrl: "https://www.dbhobby.com/",
          pageId: null,
          impressions: 20,
        },
        {
          query: "dbhobbies",
          pageUrl: "https://www.dbhobby.com/",
          pageId: null,
          impressions: 19,
        },
        { query: "dbhobby's", pageUrl: "https://www.dbhobby.com/", pageId: null, impressions: 19 },
        { query: "cianotipo", pageUrl: CIANO_PAGE, pageId: null, impressions: 187 },
      ],
    });

    expect(cards.map((card) => card.query)).toEqual(["cianotipo"]);
  });

  it("groups compact mechanical variants that share a leading page", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [
        { query: "compte gotes", clicks: 0, impressions: 28, position: 6.64285714285714 },
        { query: "comptegotes", clicks: 0, impressions: 21, position: 5.28571428571429 },
        { query: "compte-gotes", clicks: 1, impressions: 20, position: 7 },
      ],
      queryPages: [
        { query: "compte gotes", pageUrl: DROPPER_PAGE, pageId: null, impressions: 28 },
        { query: "comptegotes", pageUrl: DROPPER_PAGE, pageId: null, impressions: 21 },
        { query: "compte-gotes", pageUrl: DROPPER_PAGE, pageId: "page-dropper", impressions: 20 },
      ],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.query).toBe("compte gotes");
    expect(cards[0]?.groupingKey).toBe(opportunityCompactKey("compte gotes"));
    expect(cards[0]?.variants).toEqual(["compte gotes", "comptegotes", "compte-gotes"]);
    expect(cards[0]?.mapped).toBe(true);
    expect(cards[0]?.leadingPageId).toBe("page-dropper");
    expect(cards[0]?.id).toBe(`comptegotes\t${DROPPER_PAGE}`);
  });

  it("does not group diacritic variants, stems, or modified phrases", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [
        { query: "de donde viene la seda", clicks: 1, impressions: 4, position: 8 },
        { query: "De dónde viene la seda", clicks: 1, impressions: 2, position: 9 },
        { query: "cianotipo", clicks: 0, impressions: 187, position: 2.8 },
        { query: "cianotip", clicks: 1, impressions: 12, position: 2.75 },
        { query: "cinta de chiffon", clicks: 1, impressions: 9, position: 7.1 },
        { query: "cinta chiffon", clicks: 1, impressions: 8, position: 9 },
        { query: "pintura seda", clicks: 0, impressions: 20, position: 11 },
        { query: "pintura en seda", clicks: 0, impressions: 19, position: 12 },
        { query: "alginat", clicks: 0, impressions: 44, position: 63.4 },
        { query: "alginato", clicks: 0, impressions: 20, position: 50.95 },
      ],
      queryPages: [
        {
          query: "de donde viene la seda",
          pageUrl: "https://www.dbhobby.com/es/seda",
          pageId: "page-1",
          impressions: 4,
        },
        {
          query: "De dónde viene la seda",
          pageUrl: "https://www.dbhobby.com/es/seda",
          pageId: "page-1",
          impressions: 2,
        },
        { query: "cianotipo", pageUrl: CIANO_PAGE, pageId: null, impressions: 187 },
        {
          query: "cianotip",
          pageUrl: "https://dbhobby.com/ca/pintura-seda/set-de-cianotip",
          pageId: null,
          impressions: 12,
        },
        {
          query: "cinta de chiffon",
          pageUrl: "https://www.dbhobby.com/es/seda/cinta-crinkle-chiffon-4",
          pageId: null,
          impressions: 9,
        },
        {
          query: "cinta chiffon",
          pageUrl: "https://www.dbhobby.com/es/seda/cinta-crinkle-chiffon-4",
          pageId: null,
          impressions: 8,
        },
        {
          query: "pintura seda",
          pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
          pageId: null,
          impressions: 20,
        },
        {
          query: "pintura en seda",
          pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
          pageId: null,
          impressions: 19,
        },
        { query: "alginat", pageUrl: ALGINATE_ES, pageId: null, impressions: 31 },
        { query: "alginato", pageUrl: ALGINATE_ES, pageId: null, impressions: 20 },
      ],
    });

    expect(cards.map((card) => card.query)).toEqual([
      "cianotipo",
      "alginat",
      "alginato",
      "pintura seda",
      "pintura en seda",
      "cianotip",
      "cinta de chiffon",
      "cinta chiffon",
      "de donde viene la seda",
      "De dónde viene la seda",
    ]);
  });

  it("chooses the leading page by highest query+page impressions with a stable tie-break", () => {
    const cards = deriveQueryOpportunities({
      hostname: "foundfy.me",
      queries: [{ query: "get found", clicks: 2, impressions: 40, position: 8 }],
      queryPages: [
        { query: "get found", pageUrl: "https://www.foundfy.me/blog", pageId: null, impressions: 10 },
        { query: "get found", pageUrl: "https://www.foundfy.me/", pageId: "home", impressions: 10 },
      ],
    });

    expect(cards[0]?.leadingPageUrl).toBe("https://www.foundfy.me/");
    expect(cards[0]?.leadingPageId).toBe("home");
  });

  it("still supports an unmapped GSC URL as the leading page", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [{ query: "cianotipo", clicks: 0, impressions: 50, position: 3 }],
      queryPages: [{ query: "cianotipo", pageUrl: CIANO_PAGE, pageId: null, impressions: 50 }],
    });

    expect(cards[0]?.mapped).toBe(false);
    expect(cards[0]?.leadingPageUrl).toBe(CIANO_PAGE);
  });

  it("skips eligible queries that have no query+page row", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [{ query: "orphan demand", clicks: 4, impressions: 80, position: 5 }],
      queryPages: [],
    });

    expect(cards).toEqual([]);
  });

  it("does not emit one card per query+page row", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [{ query: "cianotipo", clicks: 0, impressions: 187, position: 2.8 }],
      queryPages: [
        { query: "cianotipo", pageUrl: CIANO_PAGE, pageId: null, impressions: 186 },
        {
          query: "cianotipo",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
          pageId: null,
          impressions: 1,
        },
      ],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.id).toBe(`cianotipo\t${CIANO_PAGE}`);
  });
});

describe("Opportunity Grain v1 contracts", () => {
  it("applies eligibility to each raw query before grouping", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [
        { query: "cianotipo", clicks: 0, impressions: 100, position: 2 },
        { query: "140 x 9", clicks: 0, impressions: 6, position: 11 },
        { query: "140x9", clicks: 0, impressions: 6, position: 12 },
        { query: "compte gotes", clicks: 0, impressions: 28, position: 6.6 },
        { query: "comptegotes", clicks: 0, impressions: 1, position: 5 },
      ],
      queryPages: [
        { query: "cianotipo", pageUrl: CIANO_PAGE, pageId: null, impressions: 100 },
        { query: "140 x 9", pageUrl: "https://dbhobby.com/es/140x9", pageId: null, impressions: 6 },
        { query: "140x9", pageUrl: "https://dbhobby.com/es/140x9", pageId: null, impressions: 6 },
        { query: "compte gotes", pageUrl: DROPPER_PAGE, pageId: null, impressions: 28 },
        { query: "comptegotes", pageUrl: DROPPER_PAGE, pageId: null, impressions: 1 },
      ],
    });

    expect(cards.map((card) => card.query)).toEqual(["cianotipo", "compte gotes"]);
    expect(cards[1]?.appearances).toBe(28);
    expect(cards[1]?.variants).toEqual(["compte gotes"]);
  });

  it("applies brand exclusion before grouping and keeps branded demand out of non-branded cards", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [
        { query: "cianotipo", clicks: 0, impressions: 187, position: 2.8 },
        { query: "dbhobby", clicks: 3, impressions: 41, position: 5.4 },
        { query: "db hobby", clicks: 8, impressions: 18, position: 2.2 },
        { query: "compte gotes", clicks: 0, impressions: 28, position: 6.6 },
      ],
      queryPages: [
        { query: "cianotipo", pageUrl: CIANO_PAGE, pageId: null, impressions: 187 },
        { query: "dbhobby", pageUrl: CIANO_PAGE, pageId: null, impressions: 41 },
        { query: "db hobby", pageUrl: CIANO_PAGE, pageId: null, impressions: 18 },
        { query: "compte gotes", pageUrl: DROPPER_PAGE, pageId: null, impressions: 28 },
      ],
    });

    expect(cards.map((card) => card.query)).toEqual(["cianotipo", "compte gotes"]);
    expect(cards[0]?.appearances).toBe(187);
    expect(cards[0]?.variants).toEqual(["cianotipo"]);
    expect(cards[0]?.id).toBe(`cianotipo\t${CIANO_PAGE}`);
    expect(
      cards.some((card) => card.variants.some((variant) => /^(dbhobby|db hobby)$/i.test(variant))),
    ).toBe(false);
  });

  it("sums query-level metrics and uses impression-weighted position", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [
        { query: "compte gotes", clicks: 0, impressions: 28, position: 6.64285714285714 },
        { query: "comptegotes", clicks: 0, impressions: 21, position: 5.28571428571429 },
      ],
      queryPages: [
        { query: "compte gotes", pageUrl: DROPPER_PAGE, pageId: null, impressions: 28 },
        { query: "compte gotes", pageUrl: DROPPER_HOLDER_PAGE, pageId: null, impressions: 2 },
        { query: "comptegotes", pageUrl: DROPPER_PAGE, pageId: null, impressions: 21 },
        { query: "comptegotes", pageUrl: GLASS_DROPPER_PAGE, pageId: null, impressions: 12 },
      ],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.appearances).toBe(49);
    expect(cards[0]?.visits).toBe(0);
    expect(cards[0]?.position).toBeCloseTo((6.64285714285714 * 28 + 5.28571428571429 * 21) / 49, 10);
    expect(cards[0]?.position).not.toBeCloseTo((6.64285714285714 + 5.28571428571429) / 2, 3);
    expect(cards[0]?.appearances).not.toBe(28 + 21 + 2 + 12);
    expect(cards[0]?.query).toBe("compte gotes");
    expect(cards[0]?.variantEvidence).toEqual([
      { query: "compte gotes", appearances: 28, visits: 0, position: 6.64285714285714 },
      { query: "comptegotes", appearances: 21, visits: 0, position: 5.28571428571429 },
    ]);
    expect(cards[0]?.memberPages).toEqual([
      { query: "compte gotes", pageUrl: DROPPER_PAGE, impressions: 28 },
      { query: "compte gotes", pageUrl: DROPPER_HOLDER_PAGE, impressions: 2 },
      { query: "comptegotes", pageUrl: DROPPER_PAGE, impressions: 21 },
      { query: "comptegotes", pageUrl: GLASS_DROPPER_PAGE, impressions: 12 },
    ]);
  });

  it("keeps compact variants on different leading pages as separate cards", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [
        { query: "compte gotes", clicks: 0, impressions: 28, position: 6.6 },
        { query: "comptegotes", clicks: 0, impressions: 21, position: 5.3 },
      ],
      queryPages: [
        { query: "compte gotes", pageUrl: DROPPER_PAGE, pageId: null, impressions: 28 },
        { query: "comptegotes", pageUrl: GLASS_DROPPER_PAGE, pageId: null, impressions: 21 },
      ],
    });

    expect(cards.map((card) => card.query)).toEqual(["compte gotes", "comptegotes"]);
    expect(cards[0]?.leadingPageUrl).toBe(DROPPER_PAGE);
    expect(cards[1]?.leadingPageUrl).toBe(GLASS_DROPPER_PAGE);
  });

  it("returns no aggregated position when grouped impressions are 0", () => {
    expect(impressionWeightedPosition([{ impressions: 0, position: 4 }, { impressions: 0, position: 8 }])).toBeNull();

    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [
        { query: "zero one", clicks: 1, impressions: 0, position: 4 },
        { query: "zeroone", clicks: 2, impressions: 0, position: 8 },
      ],
      queryPages: [
        { query: "zero one", pageUrl: "https://dbhobby.com/zero", pageId: null, impressions: 0 },
        { query: "zeroone", pageUrl: "https://dbhobby.com/zero", pageId: null, impressions: 0 },
      ],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.appearances).toBe(0);
    expect(cards[0]?.visits).toBe(3);
    expect(cards[0]?.position).toBeNull();
  });

  it("reproduces the audited DBHobby 10 → 9 compact-form result", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [
        { query: "cianotipo", clicks: 0, impressions: 187, position: 2.82352941176471 },
        { query: "compta gotes", clicks: 0, impressions: 65, position: 9.58461538461538 },
        { query: "alginat", clicks: 0, impressions: 44, position: 63.4090909090909 },
        { query: "bolas de madera con agujero", clicks: 1, impressions: 30, position: 10.2666666666667 },
        { query: "compte gotes", clicks: 0, impressions: 28, position: 6.64285714285714 },
        { query: "comptegotes", clicks: 0, impressions: 21, position: 5.28571428571429 },
        { query: "alginato", clicks: 0, impressions: 20, position: 50.95 },
        { query: "essence f", clicks: 1, impressions: 15, position: 4.46666666666667 },
        { query: "domenjo seda", clicks: 2, impressions: 2, position: 1 },
        { query: "cera para batik", clicks: 1, impressions: 2, position: 6 },
        { query: "dbhobby", clicks: 3, impressions: 41, position: 5.4 },
        { query: "db hobby", clicks: 8, impressions: 18, position: 2.2 },
        { query: "140 x 9", clicks: 0, impressions: 5, position: 11 },
        { query: "140x9", clicks: 0, impressions: 5, position: 12 },
        { query: "cianotip", clicks: 0, impressions: 12, position: 2.75 },
      ],
      queryPages: [
        { query: "cianotipo", pageUrl: CIANO_PAGE, pageId: null, impressions: 186 },
        { query: "cianotipo", pageUrl: "https://www.dbhobby.com/es/cianotipo", pageId: null, impressions: 1 },
        { query: "compta gotes", pageUrl: DROPPER_PAGE, pageId: null, impressions: 65 },
        { query: "alginat", pageUrl: ALGINATE_ES, pageId: null, impressions: 31 },
        { query: "alginat", pageUrl: ALGINATE_CA, pageId: null, impressions: 13 },
        {
          query: "bolas de madera con agujero",
          pageUrl: "https://www.dbhobby.com/es/manualidades/bola-madera-con-agujero-25",
          pageId: null,
          impressions: 13,
        },
        { query: "compte gotes", pageUrl: DROPPER_PAGE, pageId: null, impressions: 28 },
        { query: "compte gotes", pageUrl: DROPPER_HOLDER_PAGE, pageId: null, impressions: 2 },
        { query: "comptegotes", pageUrl: DROPPER_PAGE, pageId: null, impressions: 21 },
        { query: "comptegotes", pageUrl: GLASS_DROPPER_PAGE, pageId: null, impressions: 12 },
        { query: "alginato", pageUrl: ALGINATE_ES, pageId: null, impressions: 20 },
        {
          query: "essence f",
          pageUrl: "https://dbhobby.com/es/pintura-seda/disolvente-essence-f-250",
          pageId: null,
          impressions: 15,
        },
        { query: "domenjo seda", pageUrl: "https://www.dbhobby.com/", pageId: "home", impressions: 2 },
        {
          query: "cera para batik",
          pageUrl: "https://www.dbhobby.com/ca/batik-seda/cera-parafina-per-batik-1000",
          pageId: null,
          impressions: 2,
        },
        {
          query: "dbhobby",
          pageUrl: "https://www.dbhobby.com/ca/taxonomy/term/358",
          pageId: null,
          impressions: 17,
        },
        { query: "db hobby", pageUrl: "https://dbhobby.com/es/login", pageId: null, impressions: 12 },
        { query: "140 x 9", pageUrl: "https://dbhobby.com/es/140x9", pageId: null, impressions: 5 },
        { query: "140x9", pageUrl: "https://dbhobby.com/es/140x9", pageId: null, impressions: 5 },
        {
          query: "cianotip",
          pageUrl: "https://dbhobby.com/ca/pintura-seda/set-de-cianotip",
          pageId: null,
          impressions: 12,
        },
      ],
    });

    expect(cards).toHaveLength(9);
    expect(cards.map((card) => card.query)).toEqual([
      "cianotipo",
      "compta gotes",
      "compte gotes",
      "alginat",
      "bolas de madera con agujero",
      "alginato",
      "essence f",
      "domenjo seda",
      "cera para batik",
    ]);
    expect(cards.find((card) => card.query === "compte gotes")?.variants).toEqual([
      "compte gotes",
      "comptegotes",
    ]);
    expect(cards.find((card) => card.query === "compta gotes")?.variants).toEqual(["compta gotes"]);
    expect(cards.filter((card) => card.query === "alginat")).toHaveLength(1);
    expect(cards.filter((card) => card.query === "alginato")).toHaveLength(1);
    expect(cards.some((card) => card.query === "comptegotes")).toBe(false);
  });
});
