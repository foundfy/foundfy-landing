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
    ).toBe(
      "2 findings fixed · 14 findings still present · 3 new · 1 could not be verified",
    );
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
      "2 findings fixed. 3 new findings appeared. 14 findings are still present. 1 could not be verified.",
    );
  });

  it("distinguishes raw finding counts from jobs when a job count is known", () => {
    expect(
      formatComparisonSummary(
        {
          previousCrawlRunId: "prev",
          previousCompletedAt: "2026-09-09T00:00:00.000Z",
          fixed: 0,
          stillPresent: 41,
          new: 0,
          unverified: 0,
          fixedFindings: [],
        },
        8,
      ),
    ).toBe("0 findings fixed · 41 findings still present · 0 new across 8 jobs");
    expect(
      formatComparisonNarrative(
        {
          previousCrawlRunId: "prev",
          previousCompletedAt: "2026-09-09T00:00:00.000Z",
          fixed: 0,
          stillPresent: 41,
          new: 0,
          unverified: 0,
          fixedFindings: [],
        },
        8,
      ),
    ).toBe("41 findings are still present across 8 jobs.");
  });

  it("uses understated first-scan copy", () => {
    expect(formatFirstScanProgressCopy()).toBe(
      "This is your first scan. Future scans will show what changed.",
    );
  });
});
