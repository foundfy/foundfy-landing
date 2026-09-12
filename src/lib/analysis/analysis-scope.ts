import { MAX_PAGES_PER_CRAWL } from "@/lib/crawler/types";

export function formatAnalyzingScopeCopy(
  maxPages = MAX_PAGES_PER_CRAWL,
): string {
  return `Analyzing up to ${maxPages} pages`;
}

export function formatCompletedScopeCopy(pagesCrawled: number): string {
  const count = Math.max(0, pagesCrawled);

  if (count === 1) {
    return "Based on 1 analyzed page";
  }

  return `Based on ${count} analyzed pages`;
}
