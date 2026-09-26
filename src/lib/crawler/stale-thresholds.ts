/** Matches `maxDuration` on crawl API routes (seconds). */
export const CRAWL_FUNCTION_MAX_DURATION_SECONDS = 60;

/**
 * Poll-scoped threshold for reclaiming runs stuck in `running`.
 *
 * Production crawl workers run inside serverless functions capped at
 * {@link CRAWL_FUNCTION_MAX_DURATION_SECONDS}. A healthy invocation cannot
 * remain active longer than that limit. This threshold is set to 120 seconds
 * (2× the execution cap) so recently started runs are never reclaimed while
 * abandoned runs—whose worker was terminated without writing a terminal
 * status—become eligible quickly on the next status poll.
 */
export const POLL_RUNNING_STALE_MS = 120 * 1000;

/** Worker/cron path: queued runs older than this are marked failed. */
export const WORKER_QUEUED_STALE_MS = 10 * 60 * 1000;

/** Worker/cron path: running runs older than this are marked failed. */
export const WORKER_RUNNING_STALE_MS = 12 * 60 * 1000;

export function isRunningCrawlStale(
  startedAt: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (!startedAt) {
    return true;
  }

  const startedMs = new Date(startedAt).getTime();
  if (Number.isNaN(startedMs)) {
    return true;
  }

  return nowMs - startedMs >= POLL_RUNNING_STALE_MS;
}

/**
 * Latest persisted worker activity: `pages.fetched_at` or site-artifact
 * `fetched_at`. A timeout on one URL is not staleness if a recent page or
 * robots/sitemap write exists.
 */
export function isRecentWorkerActivity(
  lastActivityAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!lastActivityAt) {
    return false;
  }

  const activityMs = new Date(lastActivityAt).getTime();
  if (Number.isNaN(activityMs)) {
    return false;
  }

  return nowMs - activityMs < POLL_RUNNING_STALE_MS;
}

/**
 * Reclaim a `running` crawl only when the claim itself is stale AND there has
 * been no meaningful persisted progress inside the recovery window. This
 * prevents a healthy worker whose `started_at` crossed 120s from being
 * replaced mid-crawl (production run ec315f14).
 */
export function shouldRecoverRunningCrawl(input: {
  startedAt: string | null;
  lastActivityAt?: string | null;
  nowMs?: number;
}): boolean {
  const nowMs = input.nowMs ?? Date.now();
  if (!isRunningCrawlStale(input.startedAt, nowMs)) {
    return false;
  }

  return !isRecentWorkerActivity(input.lastActivityAt, nowMs);
}

export function pollRunningStaleCutoffIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - POLL_RUNNING_STALE_MS).toISOString();
}
