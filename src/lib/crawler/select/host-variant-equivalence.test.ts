import { describe, expect, it } from "vitest";
import {
  classifyWwwApexRelation,
  createSampleSelectionKey,
  isWwwApexHostVariantPair,
  omitRedundantEquivalentHostVariants,
  preferHostVariant,
  shouldSkipEquivalentHostVariant,
  type PageHostEvidence,
} from "./host-variant-equivalence";

const CA_WWW = "https://www.dbhobby.com/ca";
const CA_APEX = "https://dbhobby.com/ca";
const CA_HASH = "0009023f393ebb8066ee500c26f237662a204fd10d7da26dd7556c8691afa277";

function page(overrides: Partial<PageHostEvidence> & Pick<PageHostEvidence, "requestedUrl">): PageHostEvidence {
  return {
    finalUrl: overrides.finalUrl ?? overrides.requestedUrl,
    canonical: overrides.canonical ?? null,
    contentHash: overrides.contentHash ?? null,
    redirectChain: overrides.redirectChain ?? [],
    statusCode: overrides.statusCode ?? 200,
    requestedUrl: overrides.requestedUrl,
  };
}

describe("evidence-backed www/apex host variant equivalence", () => {
  it("does not treat www/apex same-path URLs as equivalent without evidence", () => {
    expect(isWwwApexHostVariantPair(CA_WWW, CA_APEX)).toBe(true);
    expect(classifyWwwApexRelation(CA_WWW, CA_APEX, [])).toBe("unknown");
    expect(
      omitRedundantEquivalentHostVariants(
        [{ url: CA_WWW }, { url: CA_APEX }],
        { seedUrl: "https://dbhobby.com/" },
      ),
    ).toEqual([{ url: CA_WWW }, { url: CA_APEX }]);
  });

  it("treats www/apex same path with the same prior content hash as equivalent", () => {
    const evidence = [
      page({ requestedUrl: CA_WWW, contentHash: CA_HASH }),
      page({ requestedUrl: CA_APEX, contentHash: CA_HASH }),
    ];

    expect(classifyWwwApexRelation(CA_WWW, CA_APEX, evidence)).toBe("equivalent");
    expect(
      omitRedundantEquivalentHostVariants([{ url: CA_WWW }, { url: CA_APEX }], {
        seedUrl: "https://dbhobby.com/",
        evidence,
      }),
    ).toEqual([{ url: CA_APEX }]);
  });

  it("treats the same canonical target as equivalent", () => {
    const evidence = [
      page({
        requestedUrl: "https://www.example.com/about",
        canonical: "https://example.com/about",
      }),
      page({
        requestedUrl: "https://example.com/about",
        canonical: "https://example.com/about",
      }),
    ];

    expect(
      classifyWwwApexRelation("https://www.example.com/about", "https://example.com/about", evidence),
    ).toBe("equivalent");
  });

  it("treats redirect/final URL overlap as equivalent", () => {
    const evidence = [
      page({
        requestedUrl: "https://ekoiq.com/",
        finalUrl: "https://www.ekoiq.com/",
        canonical: "https://www.ekoiq.com/",
        redirectChain: [{ url: "https://ekoiq.com/" }],
      }),
    ];

    expect(classifyWwwApexRelation("https://ekoiq.com/", "https://www.ekoiq.com/", evidence)).toBe(
      "equivalent",
    );
    expect(
      shouldSkipEquivalentHostVariant({
        requestedUrl: "https://www.ekoiq.com/",
        crawledUrls: ["https://ekoiq.com/"],
        evidence,
      }),
    ).toBe(true);
  });

  it("keeps both eligible when hashes conflict", () => {
    const evidence = [
      page({ requestedUrl: CA_WWW, contentHash: "aaa" }),
      page({ requestedUrl: CA_APEX, contentHash: "bbb" }),
    ];
    const keyFor = createSampleSelectionKey({
      urls: [CA_WWW, CA_APEX],
      evidence,
    });

    expect(classifyWwwApexRelation(CA_WWW, CA_APEX, evidence)).toBe("conflicting");
    expect(keyFor(CA_WWW)).not.toBe(keyFor(CA_APEX));
    expect(
      omitRedundantEquivalentHostVariants([{ url: CA_WWW }, { url: CA_APEX }], { evidence }),
    ).toEqual([{ url: CA_WWW }, { url: CA_APEX }]);
  });

  it("does not treat empty content hashes as equivalent", () => {
    const evidence = [
      page({ requestedUrl: "https://ekoiq.com/a", contentHash: null }),
      page({ requestedUrl: "https://www.ekoiq.com/a", contentHash: null }),
    ];

    expect(classifyWwwApexRelation("https://ekoiq.com/a", "https://www.ekoiq.com/a", evidence)).toBe(
      "unknown",
    );
  });

  it("keeps different paths independent even with the same content hash", () => {
    const evidence = [
      page({ requestedUrl: "https://dbhobby.com/", contentHash: CA_HASH }),
      page({ requestedUrl: CA_WWW, contentHash: CA_HASH }),
      page({ requestedUrl: CA_APEX, contentHash: CA_HASH }),
    ];

    expect(classifyWwwApexRelation("https://dbhobby.com/", CA_APEX, evidence)).toBe("unknown");
    expect(isWwwApexHostVariantPair("https://dbhobby.com/", CA_APEX)).toBe(false);
    expect(
      omitRedundantEquivalentHostVariants(
        [{ url: "https://dbhobby.com/" }, { url: CA_WWW }, { url: CA_APEX }],
        { seedUrl: "https://dbhobby.com/", evidence },
      ).map((item) => item.url),
    ).toEqual(["https://dbhobby.com/", CA_APEX]);
  });

  it("prefers the seed hostname when variants are equivalent", () => {
    expect(
      preferHostVariant([CA_WWW, CA_APEX], {
        seedUrl: "https://dbhobby.com/",
        evidence: [
          page({ requestedUrl: CA_WWW, contentHash: CA_HASH }),
          page({ requestedUrl: CA_APEX, contentHash: CA_HASH }),
        ],
      }),
    ).toBe(CA_APEX);

    expect(
      preferHostVariant([CA_WWW, CA_APEX], {
        seedUrl: "https://www.dbhobby.com/",
        evidence: [
          page({ requestedUrl: CA_WWW, contentHash: CA_HASH }),
          page({ requestedUrl: CA_APEX, contentHash: CA_HASH }),
        ],
      }),
    ).toBe(CA_WWW);
  });

  it("prefers a known canonical/final host when seed does not match either variant", () => {
    expect(
      preferHostVariant(["https://www.example.com/x", "https://example.com/x"], {
        seedUrl: "https://other.example/",
        evidence: [
          page({
            requestedUrl: "https://example.com/x",
            finalUrl: "https://www.example.com/x",
            canonical: "https://www.example.com/x",
            redirectChain: [{ url: "https://example.com/x" }],
          }),
        ],
      }),
    ).toBe("https://www.example.com/x");
  });
});
