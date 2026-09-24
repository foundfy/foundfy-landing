import {
  GOOGLE_SEARCH_ANALYTICS_MAX_ROW_LIMIT,
  GOOGLE_SEARCH_ANALYTICS_QUERY_PATH,
  GOOGLE_WEBMASTERS_SITES_URL,
  SEARCH_ANALYTICS_CAPS,
  SEARCH_ANALYTICS_REQUEST_PAGE_SIZE,
} from "./config";
import { asFiniteNumber, safeCtr } from "./metrics";
import { GoogleAuthExpiredError, GoogleSearchAnalyticsError } from "./types";

export type SearchAnalyticsDimension = "page" | "query";

export type GoogleSearchAnalyticsRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GoogleSearchAnalyticsResult = {
  rows: GoogleSearchAnalyticsRow[];
  truncated: boolean;
  responseAggregationType: string | null;
};

type QueryJson = {
  rows?: unknown;
  responseAggregationType?: unknown;
  error?: unknown;
};

function searchAnalyticsUrl(propertyUri: string): string {
  return `${GOOGLE_WEBMASTERS_SITES_URL}/${encodeURIComponent(propertyUri)}/${GOOGLE_SEARCH_ANALYTICS_QUERY_PATH}`;
}

function mapGoogleError(status: number, payload: QueryJson): never {
  if (status === 401 || status === 403) {
    throw new GoogleAuthExpiredError();
  }

  if (status === 429) {
    throw new GoogleSearchAnalyticsError("quota");
  }

  if (status >= 500) {
    throw new GoogleSearchAnalyticsError("unavailable");
  }

  if (status === 400) {
    throw new GoogleSearchAnalyticsError("malformed");
  }

  const googleError = typeof payload.error === "string" ? payload.error : null;
  if (googleError === "rateLimitExceeded") {
    throw new GoogleSearchAnalyticsError("quota");
  }

  throw new GoogleSearchAnalyticsError("unavailable");
}

export function parseSearchAnalyticsRows(payload: QueryJson): GoogleSearchAnalyticsRow[] {
  if (payload.rows == null) {
    return [];
  }

  if (!Array.isArray(payload.rows)) {
    throw new GoogleSearchAnalyticsError("malformed");
  }

  return payload.rows.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const keys =
      "keys" in entry && Array.isArray(entry.keys)
        ? entry.keys.filter((key: unknown): key is string => typeof key === "string")
        : [];
    const clicks = asFiniteNumber("clicks" in entry ? entry.clicks : 0);
    const impressions = asFiniteNumber("impressions" in entry ? entry.impressions : 0);
    const googleCtr = "ctr" in entry && typeof entry.ctr === "number" ? entry.ctr : undefined;
    const position = asFiniteNumber("position" in entry ? entry.position : 0);

    return [
      {
        keys,
        clicks,
        impressions,
        ctr: safeCtr(clicks, impressions, googleCtr),
        position,
      },
    ];
  });
}

export async function querySearchAnalytics(input: {
  accessToken: string;
  propertyUri: string;
  startDate: string;
  endDate: string;
  dimensions?: SearchAnalyticsDimension[];
  rowLimit: number;
  startRow?: number;
}): Promise<{ rows: GoogleSearchAnalyticsRow[]; responseAggregationType: string | null }> {
  const rowLimit = Math.min(
    Math.max(1, input.rowLimit),
    GOOGLE_SEARCH_ANALYTICS_MAX_ROW_LIMIT,
  );

  const response = await fetch(searchAnalyticsUrl(input.propertyUri), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: input.startDate,
      endDate: input.endDate,
      type: "web",
      ...(input.dimensions && input.dimensions.length > 0
        ? { dimensions: input.dimensions }
        : {}),
      rowLimit,
      startRow: input.startRow ?? 0,
    }),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as QueryJson;
  if (!response.ok) {
    mapGoogleError(response.status, payload);
  }

  return {
    rows: parseSearchAnalyticsRows(payload),
    responseAggregationType:
      typeof payload.responseAggregationType === "string"
        ? payload.responseAggregationType
        : null,
  };
}

export async function fetchBoundedSearchAnalytics(input: {
  accessToken: string;
  propertyUri: string;
  startDate: string;
  endDate: string;
  dimensions?: SearchAnalyticsDimension[];
  cap: number;
  pageSize?: number;
}): Promise<GoogleSearchAnalyticsResult> {
  const rows: GoogleSearchAnalyticsRow[] = [];
  let startRow = 0;
  let responseAggregationType: string | null = null;
  const pageSize = input.pageSize ?? SEARCH_ANALYTICS_REQUEST_PAGE_SIZE;

  while (rows.length < input.cap) {
    const remaining = input.cap - rows.length;
    const rowLimit = Math.min(pageSize, remaining);
    const page = await querySearchAnalytics({
      ...input,
      rowLimit,
      startRow,
    });

    if (page.responseAggregationType) {
      responseAggregationType = page.responseAggregationType;
    }

    if (page.rows.length === 0) {
      break;
    }

    rows.push(...page.rows);
    if (page.rows.length < rowLimit) {
      break;
    }

    startRow += page.rows.length;
  }

  const truncated = rows.length >= input.cap;
  return {
    rows: truncated ? rows.slice(0, input.cap) : rows,
    truncated,
    responseAggregationType,
  };
}

export async function fetchSearchAnalyticsDatasets(input: {
  accessToken: string;
  propertyUri: string;
  startDate: string;
  endDate: string;
}): Promise<{
  site: GoogleSearchAnalyticsResult;
  pages: GoogleSearchAnalyticsResult;
  queries: GoogleSearchAnalyticsResult;
  queryPages: GoogleSearchAnalyticsResult;
}> {
  const shared = {
    accessToken: input.accessToken,
    propertyUri: input.propertyUri,
    startDate: input.startDate,
    endDate: input.endDate,
  };

  try {
    const site = await fetchBoundedSearchAnalytics({
      ...shared,
      cap: SEARCH_ANALYTICS_CAPS.site,
    });
    const pages = await fetchBoundedSearchAnalytics({
      ...shared,
      dimensions: ["page"],
      cap: SEARCH_ANALYTICS_CAPS.page,
    });
    const queries = await fetchBoundedSearchAnalytics({
      ...shared,
      dimensions: ["query"],
      cap: SEARCH_ANALYTICS_CAPS.query,
    });
    const queryPages = await fetchBoundedSearchAnalytics({
      ...shared,
      dimensions: ["query", "page"],
      cap: SEARCH_ANALYTICS_CAPS.queryPage,
    });

    return { site, pages, queries, queryPages };
  } catch (error) {
    if (error instanceof GoogleAuthExpiredError || error instanceof GoogleSearchAnalyticsError) {
      throw error;
    }

    throw new GoogleSearchAnalyticsError("partial");
  }
}
