import {
  getCrawlRunSummary,
  requeueStaleRunningCrawlRun,
  resetAbandonedProcessingQueueItems,
} from "../db/repository";
import {
  isRunningCrawlStale,
  pollRunningStaleCutoffIso,
} from "../stale-thresholds";

export type RecoverStaleCrawlRunResult = {
  recovered: boolean;
};

/**
 * Poll-scoped recovery for a single crawl run stuck in `running`.
 *
 * Completed and failed runs no-op. Recent healthy running runs no-op.
 * Genuinely stale running runs are atomically moved back to `queued`, abandoned
 * `processing` queue items are reset to `pending`, and the caller may re-kick
 * the worker. Only the caller that wins the atomic update should kick processing.
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

  const staleCutoff = pollRunningStaleCutoffIso();
  const requeued = await requeueStaleRunningCrawlRun(crawlRunId, staleCutoff);

  if (!requeued) {
    return { recovered: false };
  }

  await resetAbandonedProcessingQueueItems(crawlRunId);
  return { recovered: true };
}
