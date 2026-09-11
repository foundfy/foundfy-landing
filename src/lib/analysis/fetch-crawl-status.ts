import type { CrawlStatusPayload } from "@/lib/analysis/crawl-status";

export const CRAWL_FETCH_OPTIONS: RequestInit = {
  cache: "no-store",
};

export type CrawlStatusFetchResult =
  | { ok: true; payload: CrawlStatusPayload }
  | { ok: false; status: number; error: string };

export async function fetchCrawlStatus(
  crawlRunId: string,
): Promise<CrawlStatusFetchResult> {
  const response = await fetch(`/api/crawl/${crawlRunId}`, CRAWL_FETCH_OPTIONS);
  const payload = (await response.json()) as CrawlStatusPayload & {
    error?: string;
  };

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload.error ?? "Unable to fetch crawl status.",
    };
  }

  return { ok: true, payload };
}
