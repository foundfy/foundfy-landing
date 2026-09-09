export type CrawlPollStatus = "queued" | "running" | "completed" | "failed";

export function resolveCrawlPollOutcome(
  status: CrawlPollStatus,
): "continue" | "completed" | "failed" {
  if (status === "completed") {
    return "completed";
  }

  if (status === "failed") {
    return "failed";
  }

  return "continue";
}
