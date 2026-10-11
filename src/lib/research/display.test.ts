import { describe, expect, it } from "vitest";
import {
  RESEARCH_NOT_IN_SAMPLE_COPY,
  RESEARCH_TEST_DATA_COPY,
  RESEARCH_TRUNCATED_COPY,
  currentGscSampleCopy,
  formatEstimatedMonthlySearches,
} from "./display";

describe("RESEARCH wording", () => {
  it("keeps GSC absence bounded and qualifies test data", () => {
    expect(currentGscSampleCopy("not_in_current_gsc_sample")).toBe(RESEARCH_NOT_IN_SAMPLE_COPY);
    expect(currentGscSampleCopy("not_in_current_gsc_sample")).not.toMatch(
      /rank|missing keyword|content gap|uncovered|increase traffic/i,
    );
    expect(formatEstimatedMonthlySearches(1200, "sandbox")).toBe("1,200 (test data)");
    expect(formatEstimatedMonthlySearches(1200, "live")).toBe("1,200");
    expect(formatEstimatedMonthlySearches(null, "live")).toBeNull();
    expect(RESEARCH_TEST_DATA_COPY).toMatch(/not real market demand/);
    expect(RESEARCH_TRUNCATED_COPY).toMatch(/bounded set of Google Search data/);
  });
});
