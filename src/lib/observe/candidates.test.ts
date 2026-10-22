import { describe, expect, it } from "vitest";
import { isFetchedOrEquivalent, isLanguageEligible, selectObserveCandidates } from "./candidates";

describe("observe candidate eligibility", () => {
  const base = {
    hostname: "example.com",
    keyword: "pintar en seda",
    seedOffering: "seda",
    languageCode: "es",
    links: [] as Array<{ toUrl: string; anchorText: string | null }>,
    gscRows: [] as Array<{ pageUrl: string | null; queryText: string | null }>,
    robots: { statusCode: 200, content: "User-agent: *\nAllow: /", parsed: { allow: ["/"], disallow: [], sitemaps: [] } },
  };

  it("keeps only pending source-queue rows without skip_reason", () => {
    const selected = selectObserveCandidates({
      ...base,
      queue: [
        { id: "ok", url: "https://example.com/es/pintar-en-seda", status: "pending", skipReason: null },
        { id: "done", url: "https://example.com/es/pintar-en-seda-2", status: "done", skipReason: null },
        { id: "skip", url: "https://example.com/es/pintar-en-seda-3", status: "pending", skipReason: "robots_disallow" },
      ],
      pages: [],
    });
    expect(selected.map((row) => row.queueItemId)).toEqual(["ok"]);
  });

  it("excludes fetched/equivalent, utility, locale mismatch, and robots deny", () => {
    expect(
      isFetchedOrEquivalent("https://www.example.com/es/page", [
        { id: "p1", requestedUrl: "https://example.com/es/page", finalUrl: "https://example.com/es/page", canonical: null },
      ]),
    ).toBe(true);
    expect(isLanguageEligible("https://example.com/ca/page", "es")).toBe(false);
    expect(isLanguageEligible("https://example.com/page", "es")).toBe(true);

    const selected = selectObserveCandidates({
      ...base,
      robots: { statusCode: null, content: null, parsed: { allow: [], disallow: [], sitemaps: [] } },
      queue: [
        { id: "1", url: "https://example.com/es/pintar-en-seda", status: "pending", skipReason: null },
      ],
      pages: [],
    });
    expect(selected).toEqual([]);
  });

  it("excludes utility paths and locale mismatches, keeps no-locale and robots 404", () => {
    const selected = selectObserveCandidates({
      ...base,
      robots: { statusCode: 404, content: "", parsed: { allow: [], disallow: [], sitemaps: [] } },
      queue: [
        { id: "utility", url: "https://example.com/es/login", status: "pending", skipReason: null },
        { id: "ca", url: "https://example.com/ca/pintar-en-seda", status: "pending", skipReason: null },
        { id: "nolo", url: "https://example.com/pintar-en-seda", status: "pending", skipReason: null },
        { id: "fetched", url: "https://example.com/es/pintar-en-seda", status: "pending", skipReason: null },
      ],
      pages: [
        {
          id: "p1",
          requestedUrl: "https://example.com/es/pintar-en-seda",
          finalUrl: "https://example.com/es/pintar-en-seda",
          canonical: null,
        },
      ],
    });
    expect(selected.map((row) => row.queueItemId)).toEqual(["nolo"]);
  });

  it("cannot qualify a URL from GSC alone", () => {
    const selected = selectObserveCandidates({
      ...base,
      queue: [{ id: "1", url: "https://example.com/es/about", status: "pending", skipReason: null }],
      pages: [],
      gscRows: [{ pageUrl: "https://example.com/es/about", queryText: "pintar en seda" }],
    });
    expect(selected).toEqual([]);
  });
});
