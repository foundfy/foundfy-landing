export type GoogleIdentityRecord = {
  id: string;
  googleSub: string;
  email: string | null;
};

export type GoogleOAuthTokenRecord = {
  id: string;
  googleIdentityId: string;
  encryptionKeyId: string;
  refreshTokenCiphertext: string;
  scopes: string;
  revokedAt: string | null;
};

export type ObserveOwnerRecord = {
  id: string;
  websiteId: string;
  googleIdentityId: string;
  googleOAuthTokenId: string;
  status: "google_connected" | "revoked";
};

export type OwnerSessionRecord = {
  id: string;
  googleIdentityId: string;
  websiteId: string;
  expiresAt: string;
};

export type OAuthStateRecord = {
  id: string;
  state: string;
  websiteId: string;
  returnPath: string;
  expiresAt: string;
  consumedAt: string | null;
};

export type GscPropertyType = "domain" | "url_prefix";

export type GscPropertyMatch =
  | "exact_domain"
  | "exact_url_prefix"
  | "related_host"
  | "not_a_match";

export type GscPermissionLevel = string | null;

export type GscPropertyConnectionRecord = {
  id: string;
  websiteId: string;
  observeOwnerId: string;
  googleIdentityId: string;
  propertyUri: string;
  propertyType: GscPropertyType;
  permissionLevel: GscPermissionLevel;
  confirmationSource: "user";
  status: "connected" | "revoked";
};

export type GscPropertySummary = {
  siteUrl: string;
  propertyType: GscPropertyType;
  permissionLevel: GscPermissionLevel;
};

export type RankedGscProperty = GscPropertySummary & {
  match: GscPropertyMatch;
};

export type ObserveOwnerView = {
  status: "google_connected" | "search_console_connected";
  email: string | null;
  propertySelected: boolean;
  property: GscPropertySummary | null;
};

export type ObservePropertyList = {
  recommendedSiteUrl: string | null;
  likely: RankedGscProperty[];
  other: RankedGscProperty[];
};

export class OAuthStateError extends Error {
  readonly reason: "missing" | "expired" | "reused";

  constructor(reason: "missing" | "expired" | "reused") {
    super(`OAuth state is ${reason}.`);
    this.name = "OAuthStateError";
    this.reason = reason;
  }
}

export class ObserveAuthError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = "ObserveAuthError";
    this.status = status;
  }
}

export class ObserveOwnerConflictError extends Error {
  constructor() {
    super("This site already has a Google account connected.");
    this.name = "ObserveOwnerConflictError";
  }
}

export class GoogleAuthExpiredError extends Error {
  constructor() {
    super("Google access expired. Connect Google again.");
    this.name = "GoogleAuthExpiredError";
  }
}

export class UnverifiedPropertyError extends Error {
  constructor() {
    super("That Search Console property is not available to this Google account.");
    this.name = "UnverifiedPropertyError";
  }
}

export class SearchConsoleNotConnectedError extends Error {
  constructor() {
    super("Search Console is not connected.");
    this.name = "SearchConsoleNotConnectedError";
  }
}

export type GoogleSearchAnalyticsErrorCode = "quota" | "unavailable" | "malformed" | "partial";

export class GoogleSearchAnalyticsError extends Error {
  readonly code: GoogleSearchAnalyticsErrorCode;

  constructor(code: GoogleSearchAnalyticsErrorCode) {
    super("Google Search data couldn't be refreshed right now.");
    this.name = "GoogleSearchAnalyticsError";
    this.code = code;
  }
}

export type GscSearchEvidenceType = "site" | "page" | "query" | "query_page";

export type GscSearchSyncStatus = "running" | "completed" | "failed";

export type GscSearchSyncRecord = {
  id: string;
  websiteId: string;
  propertyConnectionId: string;
  periodStart: string;
  periodEnd: string;
  status: GscSearchSyncStatus;
  source: "google_search_console_search_analytics";
  startedAt: string;
  completedAt: string | null;
  errorCode: string | null;
  siteRowCount: number;
  pageRowCount: number;
  queryRowCount: number;
  queryPageRowCount: number;
  pagesTruncated: boolean;
  queriesTruncated: boolean;
  queryPagesTruncated: boolean;
};

export type GscSearchEvidenceRecord = {
  id: string;
  syncId: string;
  websiteId: string;
  propertyConnectionId: string;
  evidenceType: GscSearchEvidenceType;
  pageUrl: string | null;
  pageId: string | null;
  queryText: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  periodStart: string;
  periodEnd: string;
  retrievedAt: string;
};

export type SearchAnalyticsMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchAnalyticsPageRow = SearchAnalyticsMetrics & {
  pageUrl: string;
  pageId: string | null;
};

export type SearchAnalyticsQueryRow = SearchAnalyticsMetrics & {
  query: string;
};

export type SearchAnalyticsQueryPageRow = SearchAnalyticsMetrics & {
  query: string;
  pageUrl: string;
  pageId: string | null;
};

export type SearchAnalyticsView = {
  status: "not_synced" | "completed";
  empty: boolean;
  periodStart: string;
  periodEnd: string;
  windowDays: number;
  syncedAt: string | null;
  source: "google_search_console_search_analytics";
  summary: SearchAnalyticsMetrics & {
    pagesSeen: number;
    queriesReported: number;
  };
  truncated: {
    pages: boolean;
    queries: boolean;
    queryPages: boolean;
  };
  pages: SearchAnalyticsPageRow[];
  queries: SearchAnalyticsQueryRow[];
};
