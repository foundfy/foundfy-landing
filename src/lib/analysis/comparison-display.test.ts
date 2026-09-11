import { describe, expect, it } from "vitest";
import {
  formatComparisonNarrative,
  formatComparisonSummary,
  formatFirstScanProgressCopy,
} from "./comparison-display";

describe("comparison display", () => {
  it("keeps compact summary formatting for scan results", () => {
    expect(
      formatComparisonSummary({
        previousCrawlRunId: "prev",
        previousCompletedAt: "2026-09-09T00:00:00.000Z",
        fixed: 2,
        stillPresent: 14,
        new: 3,
        unverified: 1,
        fixedFindings: [],
      }),
    ).toBe("2 fixed · 14 still present · 3 new · 1 could not be verified");
  });

  it("uses editorial narrative copy for site progress", () => {
    expect(
      formatComparisonNarrative({
        previousCrawlRunId: "prev",
        previousCompletedAt: "2026-09-09T00:00:00.000Z",
        fixed: 2,
        stillPresent: 14,
        new: 3,
        unverified: 1,
        fixedFindings: [],
      }),
    ).toBe(
      "2 issues fixed. 3 new issues appeared. 14 are still present. 1 could not be verified.",
    );
  });

  it("uses understated first-scan copy", () => {
    expect(formatFirstScanProgressCopy()).toBe(
      "This is your first scan. Future scans will show what changed.",
    );
  });
});
