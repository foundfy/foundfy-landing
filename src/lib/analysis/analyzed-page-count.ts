import { MAX_PAGES_PER_CRAWL } from "@/lib/crawler/types";

export function analyzedPageCountForCopy(input: {
  pagesCrawled: number;
  maxPages?: number;
  persistedPageCount?: number | null;
}): number {
  const maxPages = Math.max(0, input.maxPages ?? MAX_PAGES_PER_CRAWL);
  const persisted = input.persistedPageCount;

  if (typeof persisted === "number" && Number.isFinite(persisted) && persisted >= 0) {
    return Math.min(persisted, maxPages);
  }

  return Math.min(Math.max(0, input.pagesCrawled), maxPages);
}
