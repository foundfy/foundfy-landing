import { SEARCH_ANALYTICS_WINDOW_DAYS } from "@/lib/gsc/config";
import { findLatestCompletedSearchSync, listEvidenceForSync } from "@/lib/gsc/db-search";
import { requireSearchConsoleConnection } from "@/lib/gsc/observe";
import { searchAnalyticsWindow } from "@/lib/gsc/window";
import { deriveQueryOpportunities } from "./derive";
import type { QueryOpportunitiesView } from "./types";

function emptyView(
  status: QueryOpportunitiesView["status"],
  emptyReason: QueryOpportunitiesView["emptyReason"],
  periodStart: string,
  periodEnd: string,
): QueryOpportunitiesView {
  return {
    status,
    empty: true,
    emptyReason,
    periodStart,
    periodEnd,
    windowDays: SEARCH_ANALYTICS_WINDOW_DAYS,
    syncedAt: null,
    truncated: { queries: false, queryPages: false },
    opportunities: [],
  };
}

export async function loadQueryOpportunities(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<QueryOpportunitiesView> {
  const context = await requireSearchConsoleConnection(input);
  const window = searchAnalyticsWindow();
  const sync = await findLatestCompletedSearchSync(input.websiteId, context.connection.id);

  if (!sync) {
    return emptyView("not_synced", "not_synced", window.startDate, window.endDate);
  }

  const evidence = await listEvidenceForSync(sync.id);
  const queries = evidence.flatMap((row) => {
    if (row.evidenceType !== "query" || !row.queryText) {
      return [];
    }
    return [
      {
        query: row.queryText,
        clicks: row.clicks,
        impressions: row.impressions,
        position: row.position,
      },
    ];
  });
  const queryPages = evidence.flatMap((row) => {
    if (row.evidenceType !== "query_page" || !row.queryText || !row.pageUrl) {
      return [];
    }
    return [
      {
        query: row.queryText,
        pageUrl: row.pageUrl,
        pageId: row.pageId,
        impressions: row.impressions,
      },
    ];
  });

  const opportunities = deriveQueryOpportunities({
    hostname: context.website.hostname,
    queries,
    queryPages,
  });

  const emptyReason =
    queries.length === 0 ? "no_queries" : opportunities.length === 0 ? "no_eligible" : null;

  return {
    status: "completed",
    empty: opportunities.length === 0,
    emptyReason,
    periodStart: sync.periodStart,
    periodEnd: sync.periodEnd,
    windowDays: SEARCH_ANALYTICS_WINDOW_DAYS,
    syncedAt: sync.completedAt,
    truncated: {
      queries: sync.queriesTruncated,
      queryPages: sync.queryPagesTruncated,
    },
    opportunities,
  };
}
