import { SEARCH_ANALYTICS_TIME_ZONE, SEARCH_ANALYTICS_WINDOW_DAYS } from "@/lib/gsc/config";
import { pageComparisonKey } from "@/lib/gsc/page-map";
import { calendarDateInTimeZone } from "@/lib/gsc/window";
import type { GscSearchEvidenceRecord, GscSearchSyncRecord } from "@/lib/gsc/types";

export const LEARN_CALCULATION_VERSION = "learn_v0" as const;

export const LEARN_OUTCOME_STATES = [
  "waiting_for_data",
  "insufficient_data",
  "observed_improvement",
  "observed_decline",
  "mixed",
  "no_meaningful_change",
] as const;

export type LearnOutcomeState = (typeof LEARN_OUTCOME_STATES)[number];

export const LEARN_INSUFFICIENT_REASONS = [
  "missing_baseline_page",
  "missing_comparison_page",
  "truncated_page_dataset",
  "url_identity_changed",
  "google_evidence_removed",
] as const;

export type LearnInsufficientReason = (typeof LEARN_INSUFFICIENT_REASONS)[number];

export type LearningMetrics = {
  appearances: number;
  visits: number;
  ctr: number | null;
  position: number | null;
};

const APPEARANCES_ABS_BAND = 10;
const APPEARANCES_PCT_BAND = 0.1;
const VISITS_ABS_BAND = 1;

export function learningUrlKey(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) {
    return null;
  }
  return pageComparisonKey(rawUrl);
}

export function urlsShareLearningKey(left: string, right: string): boolean {
  const leftKey = learningUrlKey(left);
  return leftKey != null && leftKey === learningUrlKey(right);
}

export function verificationCalendarDate(verifiedAt: string): string {
  return calendarDateInTimeZone(new Date(verifiedAt), SEARCH_ANALYTICS_TIME_ZONE);
}

export function inclusivePeriodDays(periodStart: string, periodEnd: string): number {
  const start = Date.parse(`${periodStart}T00:00:00.000Z`);
  const end = Date.parse(`${periodEnd}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 0;
  }
  return Math.round((end - start) / 86_400_000) + 1;
}

export function isEligibleComparisonSync(input: {
  sync: Pick<GscSearchSyncRecord, "id" | "status" | "completedAt" | "periodStart" | "periodEnd">;
  baselineSyncId: string | null;
  verifiedAt: string;
}): boolean {
  if (input.sync.status !== "completed" || !input.sync.completedAt) {
    return false;
  }
  if (input.baselineSyncId && input.sync.id === input.baselineSyncId) {
    return false;
  }
  if (input.sync.completedAt <= input.verifiedAt) {
    return false;
  }
  if (inclusivePeriodDays(input.sync.periodStart, input.sync.periodEnd) !== SEARCH_ANALYTICS_WINDOW_DAYS) {
    return false;
  }
  return input.sync.periodStart >= verificationCalendarDate(input.verifiedAt);
}

export function selectLearningPageRow<T extends { pageUrl: string | null; evidenceType: string }>(
  targetUrl: string,
  rows: T[],
): T | null {
  const targetKey = learningUrlKey(targetUrl);
  if (!targetKey) {
    return null;
  }

  return (
    rows.find(
      (row) =>
        row.evidenceType === "page" &&
        typeof row.pageUrl === "string" &&
        learningUrlKey(row.pageUrl) === targetKey,
    ) ?? null
  );
}

export function metricsFromEvidence(
  row: Pick<GscSearchEvidenceRecord, "impressions" | "clicks" | "ctr" | "position"> | null,
): LearningMetrics | null {
  if (!row) {
    return null;
  }

  return {
    appearances: row.impressions,
    visits: row.clicks,
    ctr: Number.isFinite(row.ctr) ? row.ctr : null,
    position: Number.isFinite(row.position) ? row.position : null,
  };
}

export function appearancesMoved(before: number, after: number): boolean {
  return Math.abs(after - before) > Math.max(APPEARANCES_ABS_BAND, Math.abs(before) * APPEARANCES_PCT_BAND);
}

export function visitsMoved(before: number, after: number): boolean {
  return Math.abs(after - before) > VISITS_ABS_BAND;
}

export function outcomeFromMetrics(
  baseline: Pick<LearningMetrics, "appearances" | "visits">,
  comparison: Pick<LearningMetrics, "appearances" | "visits">,
): Exclude<LearnOutcomeState, "waiting_for_data" | "insufficient_data"> {
  const appearancesUp = comparison.appearances > baseline.appearances && appearancesMoved(baseline.appearances, comparison.appearances);
  const appearancesDown =
    comparison.appearances < baseline.appearances && appearancesMoved(baseline.appearances, comparison.appearances);
  const visitsUp = comparison.visits > baseline.visits && visitsMoved(baseline.visits, comparison.visits);
  const visitsDown = comparison.visits < baseline.visits && visitsMoved(baseline.visits, comparison.visits);

  if (!appearancesUp && !appearancesDown && !visitsUp && !visitsDown) {
    return "no_meaningful_change";
  }
  if ((appearancesUp && visitsDown) || (appearancesDown && visitsUp)) {
    return "mixed";
  }
  if (appearancesDown || visitsDown) {
    return "observed_decline";
  }
  return "observed_improvement";
}
