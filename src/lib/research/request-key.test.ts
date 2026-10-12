import { describe, expect, it } from "vitest";
import { researchRequestKey, requestKeyMatchesPair } from "./request-key";

describe("researchRequestKey", () => {
  it("is deterministic from the exact persisted offering seed and language", () => {
    expect(researchRequestKey("automated seo agency", "en")).toBe(
      researchRequestKey("automated seo agency", "en"),
    );
    expect(researchRequestKey("automated seo agency", "en")).not.toBe(
      researchRequestKey("seo services", "es"),
    );
    expect(researchRequestKey("Silk Paint", "en")).not.toBe(researchRequestKey("silk paint", "en"));
    expect(requestKeyMatchesPair(researchRequestKey("silk paint", "ca"), "silk paint", "ca")).toBe(
      true,
    );
  });

  it("does not depend on array position or execution order", () => {
    const first = ["silk paint", "gutta resist"].map((seed, index) => ({
      index,
      key: researchRequestKey(seed, "en"),
    }));
    const reversed = ["gutta resist", "silk paint"].map((seed, index) => ({
      index,
      key: researchRequestKey(seed, "en"),
    }));
    expect(first.find((item) => item.index === 0)?.key).toBe(
      reversed.find((item) => item.index === 1)?.key,
    );
  });

  it("does not embed credentials", () => {
    const key = researchRequestKey("silk paint", "en");
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key.toLowerCase()).not.toMatch(/password|authorization|basic |dataforseo/);
  });
});
