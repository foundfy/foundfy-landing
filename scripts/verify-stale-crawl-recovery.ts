/**
 * Dry-run verification for poll-scoped stale crawl recovery.
 * Usage: tsx --env-file=.env.local scripts/verify-stale-crawl-recovery.ts [crawlRunId]
 */

import { getCrawlRunSummary } from "../src/lib/crawler/db/repository";
import {
  isRunningCrawlStale,
  POLL_RUNNING_STALE_MS,
  pollRunningStaleCutoffIso,
} from "../src/lib/crawler/stale-thresholds";

const crawlRunId =
  process.argv[2] ?? "388c5109-fa75-4ba7-af55-f7c95a69122b";

async function main() {
  const summary = await getCrawlRunSummary(crawlRunId);

  if (!summary) {
    throw new Error(`Crawl run not found: ${crawlRunId}`);
  }

  const now = Date.now();
  const startedMs = summary.startedAt ? new Date(summary.startedAt).getTime() : null;
  const ageMs = startedMs ? now - startedMs : null;

  console.log(
    JSON.stringify(
      {
        crawlRunId,
        status: summary.status,
        pagesCrawled: summary.pagesCrawled,
        pagesDiscovered: summary.pagesDiscovered,
        startedAt: summary.startedAt,
        ageSeconds: ageMs === null ? null : Math.round(ageMs / 1000),
        pollRunningStaleSeconds: POLL_RUNNING_STALE_MS / 1000,
        staleCutoffIso: pollRunningStaleCutoffIso(now),
        isRunningCrawlStale: isRunningCrawlStale(summary.startedAt, now),
        wouldRecoverOnPoll:
          summary.status === "running" && isRunningCrawlStale(summary.startedAt, now),
        noOpBecauseTerminal:
          summary.status === "completed" || summary.status === "failed",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
