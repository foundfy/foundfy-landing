import { SEARCH_ANALYTICS_SOURCE } from "./config";
import { decryptSecret } from "./crypto";
import {
  completeSearchSync,
  deleteEvidenceForSync,
  failSearchSync,
  insertRunningSearchSync,
  insertSearchEvidence,
  type SearchEvidenceInsert,
} from "./db-search";
import { refreshGoogleAccessToken } from "./google";
import { listFoundfyPagesForMapping, mapGscPageUrl } from "./page-map";
import { requireSearchConsoleConnection } from "./observe";
import { fetchSearchAnalyticsDatasets, type GoogleSearchAnalyticsRow } from "./search-analytics";
import {
  GoogleAuthExpiredError,
  GoogleSearchAnalyticsError,
  type SearchAnalyticsView,
} from "./types";
import { searchAnalyticsWindow } from "./window";

function readRefreshToken(ciphertext: string | undefined): string {
  if (!ciphertext || ciphertext === "revoked") {
    throw new GoogleAuthExpiredError();
  }

  try {
    return decryptSecret(ciphertext);
  } catch {
    throw new GoogleAuthExpiredError();
  }
}

function siteRow(rows: GoogleSearchAnalyticsRow[]): GoogleSearchAnalyticsRow | null {
  return rows[0] ?? null;
}

function toViewFromSync(input: {
  periodStart: string;
  periodEnd: string;
  windowDays: number;
  syncedAt: string | null;
  site: GoogleSearchAnalyticsRow | null;
  pages: Array<{
    pageUrl: string;
    pageId: string | null;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  truncated: SearchAnalyticsView["truncated"];
}): SearchAnalyticsView {
  return {
    status: "completed",
    empty:
      (input.site?.impressions ?? 0) === 0 &&
      (input.site?.clicks ?? 0) === 0 &&
      input.pages.length === 0 &&
      input.queries.length === 0,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    windowDays: input.windowDays,
    syncedAt: input.syncedAt,
    source: SEARCH_ANALYTICS_SOURCE,
    summary: {
      clicks: input.site?.clicks ?? 0,
      impressions: input.site?.impressions ?? 0,
      ctr: input.site?.ctr ?? 0,
      position: input.site?.position ?? 0,
      pagesSeen: input.pages.length,
      queriesReported: input.queries.length,
    },
    truncated: input.truncated,
    pages: input.pages,
    queries: input.queries,
  };
}

export async function syncSearchAnalytics(input: {
  websiteId: string;
  sessionToken: string | null;
  now?: Date;
}): Promise<SearchAnalyticsView> {
  const context = await requireSearchConsoleConnection(input);
  if (!context.token || context.token.revokedAt) {
    throw new GoogleAuthExpiredError();
  }

  const window = searchAnalyticsWindow(input.now);
  const sync = await insertRunningSearchSync({
    websiteId: input.websiteId,
    propertyConnectionId: context.connection.id,
    periodStart: window.startDate,
    periodEnd: window.endDate,
  });

  try {
    const refreshToken = readRefreshToken(context.token.refreshTokenCiphertext);
    const accessToken = await refreshGoogleAccessToken(refreshToken);
    const datasets = await fetchSearchAnalyticsDatasets({
      accessToken,
      propertyUri: context.connection.propertyUri,
      startDate: window.startDate,
      endDate: window.endDate,
    });
    const pages = await listFoundfyPagesForMapping(input.websiteId);
    const retrievedAt = new Date().toISOString();

    const evidence: SearchEvidenceInsert[] = [];

    for (const row of datasets.site.rows) {
      evidence.push({
        syncId: sync.id,
        websiteId: input.websiteId,
        propertyConnectionId: context.connection.id,
        evidenceType: "site",
        pageUrl: null,
        pageId: null,
        queryText: null,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
        periodStart: window.startDate,
        periodEnd: window.endDate,
        retrievedAt,
      });
    }

    const pageRows = datasets.pages.rows.flatMap((row) => {
      const pageUrl = row.keys[0] ?? "";
      if (!pageUrl) {
        return [];
      }

      return [
        {
          syncId: sync.id,
          websiteId: input.websiteId,
          propertyConnectionId: context.connection.id,
          evidenceType: "page" as const,
          pageUrl,
          pageId: mapGscPageUrl(pageUrl, pages),
          queryText: null,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
          periodStart: window.startDate,
          periodEnd: window.endDate,
          retrievedAt,
        },
      ];
    });
    evidence.push(...pageRows);

    const queryRows = datasets.queries.rows.flatMap((row) => {
      const queryText = row.keys[0] ?? "";
      if (!queryText) {
        return [];
      }

      return [
        {
          syncId: sync.id,
          websiteId: input.websiteId,
          propertyConnectionId: context.connection.id,
          evidenceType: "query" as const,
          pageUrl: null,
          pageId: null,
          queryText,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
          periodStart: window.startDate,
          periodEnd: window.endDate,
          retrievedAt,
        },
      ];
    });
    evidence.push(...queryRows);

    const queryPageRows = datasets.queryPages.rows.flatMap((row) => {
      const queryText = row.keys[0] ?? "";
      const pageUrl = row.keys[1] ?? "";
      if (!queryText || !pageUrl) {
        return [];
      }

      return [
        {
          syncId: sync.id,
          websiteId: input.websiteId,
          propertyConnectionId: context.connection.id,
          evidenceType: "query_page" as const,
          pageUrl,
          pageId: mapGscPageUrl(pageUrl, pages),
          queryText,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
          periodStart: window.startDate,
          periodEnd: window.endDate,
          retrievedAt,
        },
      ];
    });
    evidence.push(...queryPageRows);

    await insertSearchEvidence(evidence);
    const completed = await completeSearchSync({
      id: sync.id,
      siteRowCount: datasets.site.rows.length,
      pageRowCount: pageRows.length,
      queryRowCount: queryRows.length,
      queryPageRowCount: queryPageRows.length,
      pagesTruncated: datasets.pages.truncated,
      queriesTruncated: datasets.queries.truncated,
      queryPagesTruncated: datasets.queryPages.truncated,
    });

    return toViewFromSync({
      periodStart: window.startDate,
      periodEnd: window.endDate,
      windowDays: window.windowDays,
      syncedAt: completed.completedAt,
      site: siteRow(datasets.site.rows),
      pages: pageRows.map((row) => ({
        pageUrl: row.pageUrl ?? "",
        pageId: row.pageId,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })),
      queries: queryRows.map((row) => ({
        query: row.queryText ?? "",
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })),
      truncated: {
        pages: completed.pagesTruncated,
        queries: completed.queriesTruncated,
        queryPages: completed.queryPagesTruncated,
      },
    });
  } catch (error) {
    try {
      await deleteEvidenceForSync(sync.id);
      const errorCode =
        error instanceof GoogleAuthExpiredError
          ? "auth_expired"
          : error instanceof GoogleSearchAnalyticsError
            ? error.code
            : "unavailable";
      await failSearchSync({ id: sync.id, errorCode });
    } catch {
      // The original error is more useful to the owner than a cleanup failure.
    }

    throw error;
  }
}
