import {
  getCrawlRunSummary,
  getLatestCrawlActivityAt,
  requeueStaleRunningCrawlRun,
  resetAbandonedProcessingQueueItems,
} from "../db/repository";
import {
  isRunningCrawlStale,
  pollRunningStaleCutoffIso,
  shouldRecoverRunningCrawl,
} from "../stale-thresholds";

export type RecoverStaleCrawlRunResult = {
  recovered: boolean;
};

/**
 * Poll-scoped recovery for a single crawl run stuck in `running`.
 *
 * Completed and failed runs no-op. Recent healthy running runs no-op, including
 * workers whose claim is older than 120s but that still have recent page or
 * robots/sitemap activity. Genuinely stale running runs (old claim AND no
 * recent persisted activity) are atomically moved back to `queued`, abandoned
 * `processing` queue items are reset to `pending`, and the caller may re-kick
 * the worker. Only the caller that wins the atomic update should kick processing.
 *
 * Production run `ec315f14-6e38-4bcc-acdc-1d5f63ee5e11` was falsely reclaimed
 * while Worker A was still fetching: `started_at` had crossed 120s, but
 * `pages.fetched_at` was seconds old. Worker B then claimed, both mutated
 * progress, and `pages_crawled` became 11 with 10 persisted pages.
 */
export async function maybeRecoverStaleCrawlRun(
  crawlRunId: string,
): Promise<RecoverStaleCrawlRunResult> {
  const summary = await getCrawlRunSummary(crawlRunId);

  if (!summary) {
    return { recovered: false };
  }

  if (summary.status === "completed" || summary.status === "failed") {
    return { recovered: false };
  }

  if (summary.status !== "running") {
    return { recovered: false };
  }

  if (!isRunningCrawlStale(summary.startedAt)) {
    return { recovered: false };
  }

  let lastActivityAt: string | null = null;
  try {
    lastActivityAt = await getLatestCrawlActivityAt(crawlRunId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load crawl activity.";
    console.error(
      "[Crawl] Skipping stale recovery because worker activity could not be loaded:",
      message,
    );
    return { recovered: false };
  }

  if (
    !shouldRecoverRunningCrawl({
      startedAt: summary.startedAt,
      lastActivityAt,
    })
  ) {
    return { recovered: false };
  }

  const staleCutoff = pollRunningStaleCutoffIso();
  const requeued = await requeueStaleRunningCrawlRun(crawlRunId, staleCutoff);

  if (!requeued) {
    return { recovered: false };
  }

  await resetAbandonedProcessingQueueItems(crawlRunId);
  return { recovered: true };
}
