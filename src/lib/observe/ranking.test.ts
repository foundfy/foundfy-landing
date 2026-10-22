import { describe, expect, it } from "vitest";
import { hasExactGscSupport, rankObserveCandidates } from "./ranking";

describe("observe candidate ranking", () => {
  it("ranks exact phrase ahead of tokens and caps at 5", () => {
    const ranked = rankObserveCandidates({
      keyword: "pintar en seda",
      seedOffering: "seda",
      urls: [
        {
          queueItemId: "2",
          url: "https://example.com/es/seda",
          urlKey: "https://example.com/es/seda",
        },
        {
          queueItemId: "1",
          url: "https://example.com/es/pintar-en-seda",
          urlKey: "https://example.com/es/pintar-en-seda",
        },
        {
          queueItemId: "3",
          url: "https://example.com/about",
          urlKey: "https://example.com/about",
        },
      ],
      links: [],
      gscRows: [],
    });

    expect(ranked[0]?.url).toContain("pintar-en-seda");
    expect(ranked.some((row) => row.url.endsWith("/about"))).toBe(false);
  });

  it("does not treat pintura as pintar", () => {
    const ranked = rankObserveCandidates({
      keyword: "pintar en seda",
      seedOffering: "studio",
      urls: [
        {
          queueItemId: "1",
          url: "https://example.com/es/pintura-en-seda",
          urlKey: "https://example.com/es/pintura-en-seda",
        },
      ],
      links: [],
      gscRows: [],
    });
    expect(ranked).toEqual([]);
  });

  it("lets incoming anchors qualify and keeps GSC supporting-only", () => {
    const url = "https://example.com/es/seda";
    expect(
      hasExactGscSupport({
        urlKey: url,
        keyword: "pintar en seda",
        gscRows: [{ pageUrl: url, queryText: "pintar en seda" }],
      }),
    ).toBe(true);

    const gscOnly = rankObserveCandidates({
      keyword: "pintar en seda",
      seedOffering: "studio",
      urls: [{ queueItemId: "1", url, urlKey: url }],
      links: [],
      gscRows: [{ pageUrl: url, queryText: "pintar en seda" }],
    });
    expect(gscOnly).toEqual([]);

    const withAnchor = rankObserveCandidates({
      keyword: "pintar en seda",
      seedOffering: "studio",
      urls: [{ queueItemId: "1", url, urlKey: url }],
      links: [{ toUrl: url, anchorText: "como pintar en seda" }],
      gscRows: [{ pageUrl: url, queryText: "pintar en seda" }],
    });
    expect(withAnchor).toHaveLength(1);
    expect(withAnchor[0]?.rankClass).toBe("incoming_anchor");
    expect(withAnchor[0]?.gscSupport).toBe(true);
  });

  it("caps at 5 and uses GSC only as a same-class tie-break", () => {
    const urls = [1, 2, 3, 4, 5, 6].map((n) => ({
      queueItemId: String(n),
      url: `https://example.com/es/pintar-en-seda-${n}`,
      urlKey: `https://example.com/es/pintar-en-seda-${n}`,
    }));
    const ranked = rankObserveCandidates({
      keyword: "pintar en seda",
      seedOffering: "seda",
      urls,
      links: [],
      gscRows: [],
    });
    expect(ranked).toHaveLength(5);

    const left = "https://example.com/es/seda-a";
    const right = "https://example.com/es/seda-b";
    const tied = rankObserveCandidates({
      keyword: "pintar en seda",
      seedOffering: "seda",
      urls: [
        { queueItemId: "2", url: right, urlKey: right },
        { queueItemId: "1", url: left, urlKey: left },
      ],
      links: [],
      gscRows: [{ pageUrl: right, queryText: "pintar en seda" }],
    });
    expect(tied[0]?.url).toBe(right);
    expect(tied[0]?.gscSupport).toBe(true);
    expect(tied[1]?.gscSupport).toBe(false);
  });
});
