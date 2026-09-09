import type { CrawlLifecycleStatus } from "./crawl-status";

export const CRAWL_PROGRESS = {
  queued: { floor: 0.1, target: 0.22 },
  running: { floor: 0.38, ceiling: 0.9 },
  completed: 1,
} as const;

export function getCrawlStatusCopy(status: CrawlLifecycleStatus): string {
  switch (status) {
    case "queued":
      return "Preparing crawl";
    case "running":
      return "Crawling pages · checking structure";
    case "completed":
      return "Analysis complete";
    default:
      return "Preparing crawl";
  }
}

export function getProgressTarget(
  status: CrawlLifecycleStatus,
  pagesCrawled: number,
  maxPages: number,
  runningElapsedMs: number,
): number {
  if (status === "completed") {
    return CRAWL_PROGRESS.completed;
  }

  if (status === "queued") {
    return CRAWL_PROGRESS.queued.target;
  }

  const pageRatio =
    maxPages > 0 ? Math.min(pagesCrawled / maxPages, 1) : 0;
  const elapsedRatio = Math.min(runningElapsedMs / 45_000, 1);
  const runningProgress =
    CRAWL_PROGRESS.running.floor +
    pageRatio * 0.28 +
    elapsedRatio * 0.18;

  return Math.min(CRAWL_PROGRESS.running.ceiling, runningProgress);
}

export function easeProgress(current: number, target: number): number {
  if (target <= current) {
    return target;
  }

  const delta = target - current;
  return current + delta * 0.22;
}
