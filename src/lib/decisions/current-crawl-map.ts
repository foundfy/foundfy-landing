import { mapGscPageUrl, type FoundfyPageRef } from "@/lib/gsc/page-map";
import type { GscPageEvidenceInput } from "./types";

export type GscEvidenceRowForCurrentCrawl = {
  id: string;
  pageUrl: string;
  storedPageId: string | null;
  clicks: number;
  impressions: number;
};

/**
 * Derives Decision Engine page ids from the raw Google URL against the current
 * crawl sample. Ignores the historical GSC `page_id` written at sync time.
 */
export function mapGscEvidenceToCurrentCrawl(
  rows: GscEvidenceRowForCurrentCrawl[],
  pages: FoundfyPageRef[],
): GscPageEvidenceInput[] {
  return rows.map((row) => ({
    id: row.id,
    pageUrl: row.pageUrl,
    pageId: mapGscPageUrl(row.pageUrl, pages),
    storedPageId: row.storedPageId,
    clicks: row.clicks,
    impressions: row.impressions,
  }));
}
