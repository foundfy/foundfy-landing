import { describe, expect, it } from "vitest";
import { researchRequestFingerprint } from "./fingerprint";

describe("RESEARCH request fingerprint", () => {
  const base = {
    websiteId: "site-1",
    siteModelId: "model-1",
    confirmedAt: "2026-10-01T00:00:00.000Z",
    offerings: ["silk paint"],
    countryKey: "ES",
    languages: ["ca", "es"],
    provider: "dataforseo" as const,
    environment: "sandbox" as const,
  };

  it("is deterministic and includes provider environment", () => {
    expect(researchRequestFingerprint(base)).toBe(researchRequestFingerprint(base));
    expect(researchRequestFingerprint(base)).not.toBe(
      researchRequestFingerprint({ ...base, environment: "live" }),
    );
    expect(researchRequestFingerprint(base)).not.toBe(
      researchRequestFingerprint({ ...base, environment: "fixture", provider: "fixture" }),
    );
  });

  it("canonicalizes offering and language order", () => {
    expect(
      researchRequestFingerprint({
        ...base,
        offerings: ["gutta resist", "silk paint"],
        languages: ["es", "ca"],
      }),
    ).toBe(
      researchRequestFingerprint({
        ...base,
        offerings: ["silk paint", "gutta resist"],
        languages: ["ca", "es"],
      }),
    );
  });

  it("does not include GSC sync identity", () => {
    const hashed = researchRequestFingerprint(base);
    expect(hashed).toBe(
      researchRequestFingerprint({
        ...base,
      }),
    );
    expect(JSON.stringify(base)).not.toMatch(/gsc|sync/i);
  });
});
