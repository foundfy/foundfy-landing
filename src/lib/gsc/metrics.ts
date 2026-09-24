/**
 * Search Analytics metric helpers.
 *
 * Clicks and impressions may be summed across rows of the same grain.
 * CTR must never be averaged across rows. Use clicks / impressions, or
 * Google's own row-level `ctr`.
 * Average position must never be averaged across already-aggregated rows.
 * Site totals come from Google's no-dimension aggregate, not from page/query rows.
 */

export function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function safeCtr(clicks: number, impressions: number, googleCtr?: number): number {
  if (typeof googleCtr === "number" && Number.isFinite(googleCtr)) {
    return googleCtr;
  }

  if (impressions <= 0) {
    return 0;
  }

  return clicks / impressions;
}
