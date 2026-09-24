import { describe, expect, it } from "vitest";
import { safeCtr } from "./metrics";

describe("Search Analytics metric correctness", () => {
  it("uses Google's CTR when present instead of averaging rows", () => {
    expect(safeCtr(9, 430, 0.02093)).toBe(0.02093);
  });

  it("computes CTR as clicks / impressions only when Google omitted ctr", () => {
    expect(safeCtr(9, 430)).toBeCloseTo(9 / 430);
    expect(safeCtr(5, 0)).toBe(0);
  });

  it("does not average already-aggregated positions", () => {
    const sitePosition = 8.4;
    const pagePositions = [3.1, 12.8, 9.2];
    const naiveAverage =
      pagePositions.reduce((sum, value) => sum + value, 0) / pagePositions.length;

    expect(sitePosition).not.toBeCloseTo(naiveAverage);
    expect(sitePosition).toBe(8.4);
  });
});
