import type { CrawlLifecycleStatus } from "@/lib/analysis/crawl-status";

export const ZERO_PAGE_CRAWL_FAILURE_MESSAGE =
  "We couldn't successfully crawl any pages from this website.";

export function isUsableCompletedCrawl(input: {
  status: CrawlLifecycleStatus | string;
  pagesCrawled: number;
}): boolean {
  return input.status === "completed" && input.pagesCrawled > 0;
}

export function normalizeCrawlStatusForApiResponse<
  T extends {
    status: CrawlLifecycleStatus | string;
    pagesCrawled: number;
    errorMessage: string | null;
  },
>(summary: T): T {
  if (summary.status === "completed" && summary.pagesCrawled === 0) {
    return {
      ...summary,
      status: "failed",
      errorMessage: summary.errorMessage ?? ZERO_PAGE_CRAWL_FAILURE_MESSAGE,
    };
  }

  return summary;
}
