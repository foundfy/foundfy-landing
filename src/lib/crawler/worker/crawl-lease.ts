export class CrawlLeaseLostError extends Error {
  readonly crawlRunId: string;

  constructor(crawlRunId: string) {
    super("Crawl worker lease lost.");
    this.name = "CrawlLeaseLostError";
    this.crawlRunId = crawlRunId;
  }
}

export function isCurrentCrawlLease(
  snapshot: { status?: string; startedAt: string | null } | null | undefined,
  expectedStartedAt: string | null,
): boolean {
  if (!snapshot) {
    return false;
  }

  if (snapshot.status != null && snapshot.status !== "running") {
    return false;
  }

  return snapshot.startedAt === expectedStartedAt;
}
