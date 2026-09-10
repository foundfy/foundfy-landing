import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import {
  WORKER_QUEUED_STALE_MS,
  WORKER_RUNNING_STALE_MS,
} from "../stale-thresholds";
import { markCrawlRunFailed } from "../db/repository";

export async function reclaimStaleCrawlRuns(): Promise<{
  failedQueued: string[];
  failedRunning: string[];
}> {
  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const failedQueued: string[] = [];
  const failedRunning: string[] = [];

  const { data: queuedRuns, error: queuedError } = await supabase
    .from("crawl_runs")
    .select("id, created_at")
    .eq("status", "queued");

  if (queuedError) {
    throw new Error(`Failed to load queued crawl runs: ${queuedError.message}`);
  }

  for (const run of queuedRuns ?? []) {
    const createdAt = new Date(run.created_at).getTime();
    if (Number.isNaN(createdAt) || now - createdAt < WORKER_QUEUED_STALE_MS) {
      continue;
    }

    const failed = await markCrawlRunFailed(
      run.id,
      "Crawl remained queued too long and was marked failed. Please try again.",
    );
    if (failed) {
      failedQueued.push(run.id);
    }
  }

  const { data: runningRuns, error: runningError } = await supabase
    .from("crawl_runs")
    .select("id, started_at")
    .eq("status", "running");

  if (runningError) {
    throw new Error(`Failed to load running crawl runs: ${runningError.message}`);
  }

  for (const run of runningRuns ?? []) {
    if (!run.started_at) {
      continue;
    }

    const startedAt = new Date(run.started_at).getTime();
    if (Number.isNaN(startedAt) || now - startedAt < WORKER_RUNNING_STALE_MS) {
      continue;
    }

    const failed = await markCrawlRunFailed(run.id, "Crawl timed out before completion.");
    if (failed) {
      failedRunning.push(run.id);
    }
  }

  return { failedQueued, failedRunning };
}
