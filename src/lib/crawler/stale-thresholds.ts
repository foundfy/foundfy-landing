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

export function pollRunningStaleCutoffIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - POLL_RUNNING_STALE_MS).toISOString();
}
