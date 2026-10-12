import { describe, expect, it } from "vitest";
import {
  RESEARCH_CLOSE_LABEL,
  RESEARCH_CLOSED_COPY,
  RESEARCH_INTERRUPTED_COPY,
  RESEARCH_NEW_CYCLE_LABEL,
  RESEARCH_NOT_IN_SAMPLE_COPY,
  RESEARCH_NO_REPLAY_COPY,
  RESEARCH_NO_SAFE_RETRY_COPY,
  RESEARCH_RESUME_UNATTEMPTED_LABEL,
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
    expect(RESEARCH_INTERRUPTED_COPY).toBe("This research run was interrupted.");
    expect(RESEARCH_NO_REPLAY_COPY).toMatch(/will not automatically repeat requests/);
    expect(RESEARCH_RESUME_UNATTEMPTED_LABEL).toBe("Resume unattempted requests");
    expect(RESEARCH_NO_SAFE_RETRY_COPY).toMatch(/no requests Foundfy can safely repeat automatically/);
    expect(RESEARCH_RESUME_UNATTEMPTED_LABEL).not.toMatch(/retry all/i);
    expect(RESEARCH_CLOSED_COPY).toBe("This research run was closed.");
    expect(RESEARCH_CLOSE_LABEL).toBe("Close this research run");
    expect(RESEARCH_CLOSE_LABEL).not.toMatch(/retry/i);
    expect(RESEARCH_NEW_CYCLE_LABEL).toBe("Start a new research cycle");
    expect(RESEARCH_NEW_CYCLE_LABEL).not.toMatch(/retry/i);
  });
});
