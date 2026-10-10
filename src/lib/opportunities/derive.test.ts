import { describe, expect, it } from "vitest";
import { deriveQueryOpportunities } from "./derive";
import { opportunityQueryKey } from "./normalize";

const CIANO_PAGE = "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo";

describe("Opportunity Discovery v0 derivation", () => {
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

  it("groups case, accent, punctuation, and whitespace variants", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [
        { query: "de donde viene la seda", clicks: 0, impressions: 4, position: 8 },
        { query: "De dónde viene la seda", clicks: 0, impressions: 2, position: 9 },
        { query: "de-donde  viene la seda", clicks: 1, impressions: 1, position: 7 },
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
      ],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0]?.query).toBe("de donde viene la seda");
    expect(cards[0]?.groupingKey).toBe(opportunityQueryKey("de dónde viene la seda"));
    expect(cards[0]?.variants).toEqual([
      "de donde viene la seda",
      "De dónde viene la seda",
      "de-donde  viene la seda",
    ]);
    expect(cards[0]?.mapped).toBe(true);
    expect(cards[0]?.leadingPageId).toBe("page-1");
  });

  it("does not stem or semantically merge distinct phrases", () => {
    const cards = deriveQueryOpportunities({
      hostname: "dbhobby.com",
      queries: [
        { query: "cianotipo", clicks: 0, impressions: 187, position: 2.8 },
        { query: "cianotip", clicks: 1, impressions: 12, position: 2.75 },
        { query: "cinta de chiffon", clicks: 1, impressions: 9, position: 7.1 },
        { query: "cinta chiffon", clicks: 1, impressions: 8, position: 9 },
        { query: "pintura seda", clicks: 0, impressions: 20, position: 11 },
        { query: "pintura en seda", clicks: 0, impressions: 19, position: 12 },
      ],
      queryPages: [
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
      ],
    });

    expect(cards.map((card) => card.query)).toEqual([
      "cianotipo",
      "pintura seda",
      "pintura en seda",
      "cianotip",
      "cinta de chiffon",
      "cinta chiffon",
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
