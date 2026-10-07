import { describe, expect, it } from "vitest";
import {
  appearancesMoved,
  inclusivePeriodDays,
  isEligibleComparisonSync,
  outcomeFromMetrics,
  selectLearningPageRow,
  urlsShareLearningKey,
  verificationCalendarDate,
  visitsMoved,
} from "./learning";

const TARGET = "https://www.foundfy.me/";

function pageRow(pageUrl: string) {
  return {
    evidenceType: "page" as const,
    pageUrl,
    impressions: 120,
    clicks: 4,
    ctr: 0.033,
    position: 12.1,
  };
}

describe("LEARN v0 evidence contract", () => {
  it("treats www, apex, protocol, trailing slash, and hash as the same URL", () => {
    expect(urlsShareLearningKey(TARGET, "http://foundfy.me")).toBe(true);
    expect(urlsShareLearningKey(TARGET, "https://foundfy.me/")).toBe(true);
    expect(urlsShareLearningKey(TARGET, "https://www.foundfy.me/#hero")).toBe(true);
    expect(selectLearningPageRow(TARGET, [pageRow("https://foundfy.me/")])?.pageUrl).toBe(
      "https://foundfy.me/",
    );
  });

  it("does not join a different canonical path", () => {
    expect(urlsShareLearningKey(TARGET, "https://www.foundfy.me/home")).toBe(false);
    expect(selectLearningPageRow(TARGET, [pageRow("https://www.foundfy.me/home")])).toBeNull();
  });

  it("requires a later 28-day window that starts on or after verification", () => {
    const verifiedAt = "2026-10-06T20:58:27.000Z";
    expect(verificationCalendarDate(verifiedAt)).toBe("2026-10-06");
    expect(inclusivePeriodDays("2026-10-06", "2026-11-02")).toBe(28);

    expect(
      isEligibleComparisonSync({
        sync: {
          id: "sync-overlap",
          status: "completed",
          completedAt: "2026-10-20T00:00:00.000Z",
          periodStart: "2026-09-23",
          periodEnd: "2026-10-20",
        },
        baselineSyncId: "sync-baseline",
        verifiedAt,
      }),
    ).toBe(false);

    expect(
      isEligibleComparisonSync({
        sync: {
          id: "sync-later",
          status: "completed",
          completedAt: "2026-11-03T00:00:00.000Z",
          periodStart: "2026-10-07",
          periodEnd: "2026-11-03",
        },
        baselineSyncId: "sync-baseline",
        verifiedAt,
      }),
    ).toBe(true);

    expect(
      isEligibleComparisonSync({
        sync: {
          id: "sync-short",
          status: "completed",
          completedAt: "2026-11-03T00:00:00.000Z",
          periodStart: "2026-10-10",
          periodEnd: "2026-11-03",
        },
        baselineSyncId: "sync-baseline",
        verifiedAt,
      }),
    ).toBe(false);
  });

  it("computes improvement, decline, mixed, and no meaningful change from appearances and visits", () => {
    expect(outcomeFromMetrics({ appearances: 120, visits: 4 }, { appearances: 147, visits: 6 })).toBe(
      "observed_improvement",
    );
    expect(outcomeFromMetrics({ appearances: 147, visits: 6 }, { appearances: 120, visits: 4 })).toBe(
      "observed_decline",
    );
    expect(outcomeFromMetrics({ appearances: 120, visits: 6 }, { appearances: 147, visits: 4 })).toBe(
      "mixed",
    );
    expect(outcomeFromMetrics({ appearances: 120, visits: 4 }, { appearances: 125, visits: 5 })).toBe(
      "no_meaningful_change",
    );
  });

  it("does not let CTR or position drive the outcome", () => {
    expect(appearancesMoved(120, 125)).toBe(false);
    expect(visitsMoved(4, 5)).toBe(false);
    expect(
      outcomeFromMetrics({ appearances: 120, visits: 4 }, { appearances: 125, visits: 5 }),
    ).toBe("no_meaningful_change");
  });
});
