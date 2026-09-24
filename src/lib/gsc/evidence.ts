import { SEARCH_ANALYTICS_SOURCE, SEARCH_ANALYTICS_WINDOW_DAYS } from "./config";
import { findLatestCompletedSearchSync, listEvidenceForSync } from "./db-search";
import { requireSearchConsoleConnection } from "./observe";
import type { SearchAnalyticsView } from "./types";
import { searchAnalyticsWindow } from "./window";

export async function loadSearchAnalyticsEvidence(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<SearchAnalyticsView> {
  const context = await requireSearchConsoleConnection(input);
  const window = searchAnalyticsWindow();
  const sync = await findLatestCompletedSearchSync(input.websiteId, context.connection.id);

  if (!sync) {
    return {
      status: "not_synced",
      empty: true,
      periodStart: window.startDate,
      periodEnd: window.endDate,
      windowDays: SEARCH_ANALYTICS_WINDOW_DAYS,
      syncedAt: null,
      source: SEARCH_ANALYTICS_SOURCE,
      summary: {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        pagesSeen: 0,
        queriesReported: 0,
      },
      truncated: { pages: false, queries: false, queryPages: false },
      pages: [],
      queries: [],
    };
  }

  const evidence = await listEvidenceForSync(sync.id);
  const site = evidence.find((row) => row.evidenceType === "site") ?? null;
  const pages = evidence
    .filter((row) => row.evidenceType === "page" && row.pageUrl)
    .map((row) => ({
      pageUrl: row.pageUrl as string,
      pageId: row.pageId,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));
  const queries = evidence
    .filter((row) => row.evidenceType === "query" && row.queryText)
    .map((row) => ({
      query: row.queryText as string,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));

  return {
    status: "completed",
    empty:
      (site?.impressions ?? 0) === 0 &&
      (site?.clicks ?? 0) === 0 &&
      pages.length === 0 &&
      queries.length === 0,
    periodStart: sync.periodStart,
    periodEnd: sync.periodEnd,
    windowDays: SEARCH_ANALYTICS_WINDOW_DAYS,
    syncedAt: sync.completedAt,
    source: SEARCH_ANALYTICS_SOURCE,
    summary: {
      clicks: site?.clicks ?? 0,
      impressions: site?.impressions ?? 0,
      ctr: site?.ctr ?? 0,
      position: site?.position ?? 0,
      pagesSeen: pages.length,
      queriesReported: queries.length,
    },
    truncated: {
      pages: sync.pagesTruncated,
      queries: sync.queriesTruncated,
      queryPages: sync.queryPagesTruncated,
    },
    pages,
    queries,
  };
}
