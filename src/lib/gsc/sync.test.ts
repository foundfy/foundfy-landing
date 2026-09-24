import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "./crypto";
import { GoogleAuthExpiredError, GoogleSearchAnalyticsError, SearchConsoleNotConnectedError } from "./types";

const getWebsiteByIdMock = vi.fn();
const findOwnerSessionByTokenHashMock = vi.fn();
const findActiveObserveOwnerMock = vi.fn();
const findGoogleIdentityByIdMock = vi.fn();
const findGoogleOAuthTokenByIdMock = vi.fn();
const findActivePropertyConnectionMock = vi.fn();
const refreshGoogleAccessTokenMock = vi.fn();
const fetchSearchAnalyticsDatasetsMock = vi.fn();
const listFoundfyPagesForMappingMock = vi.fn();
const insertRunningSearchSyncMock = vi.fn();
const insertSearchEvidenceMock = vi.fn();
const completeSearchSyncMock = vi.fn();
const failSearchSyncMock = vi.fn();
const deleteEvidenceForSyncMock = vi.fn();

vi.mock("@/lib/websites/repository", () => ({
  getWebsiteById: (...args: unknown[]) => getWebsiteByIdMock(...args),
}));

vi.mock("./db", () => ({
  findOwnerSessionByTokenHash: (...args: unknown[]) => findOwnerSessionByTokenHashMock(...args),
  findActiveObserveOwner: (...args: unknown[]) => findActiveObserveOwnerMock(...args),
  findGoogleIdentityById: (...args: unknown[]) => findGoogleIdentityByIdMock(...args),
  findGoogleOAuthTokenById: (...args: unknown[]) => findGoogleOAuthTokenByIdMock(...args),
  findActivePropertyConnection: (...args: unknown[]) =>
    findActivePropertyConnectionMock(...args),
}));

vi.mock("./google", () => ({
  refreshGoogleAccessToken: (...args: unknown[]) => refreshGoogleAccessTokenMock(...args),
}));

vi.mock("./search-analytics", () => ({
  fetchSearchAnalyticsDatasets: (...args: unknown[]) =>
    fetchSearchAnalyticsDatasetsMock(...args),
}));

vi.mock("./page-map", async () => {
  const actual = await vi.importActual<typeof import("./page-map")>("./page-map");
  return {
    ...actual,
    listFoundfyPagesForMapping: (...args: unknown[]) =>
      listFoundfyPagesForMappingMock(...args),
  };
});

vi.mock("./db-search", () => ({
  insertRunningSearchSync: (...args: unknown[]) => insertRunningSearchSyncMock(...args),
  insertSearchEvidence: (...args: unknown[]) => insertSearchEvidenceMock(...args),
  completeSearchSync: (...args: unknown[]) => completeSearchSyncMock(...args),
  failSearchSync: (...args: unknown[]) => failSearchSyncMock(...args),
  deleteEvidenceForSync: (...args: unknown[]) => deleteEvidenceForSyncMock(...args),
}));

import { syncSearchAnalytics } from "./sync";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const OTHER_WEBSITE_ID = "11111111-1111-1111-1111-111111111111";
const SESSION_TOKEN = "owner-session-token";
const ORIGINAL_ENV = { ...process.env };

function emptyDataset(truncated = false) {
  return { rows: [], truncated, responseAggregationType: null };
}

describe("Search Analytics sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.GSC_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
    process.env.GSC_SESSION_SECRET = "session-secret";
    getWebsiteByIdMock.mockResolvedValue({
      id: WEBSITE_ID,
      hostname: "foundfy.me",
      displayUrl: "https://www.foundfy.me/",
    });
    findOwnerSessionByTokenHashMock.mockResolvedValue({
      id: "session-1",
      googleIdentityId: "identity-1",
      websiteId: WEBSITE_ID,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    findGoogleIdentityByIdMock.mockResolvedValue({
      id: "identity-1",
      googleSub: "google-sub-1",
      email: "hello@foundfy.me",
    });
    findGoogleOAuthTokenByIdMock.mockResolvedValue({
      id: "token-1",
      googleIdentityId: "identity-1",
      encryptionKeyId: "v1",
      refreshTokenCiphertext: encryptSecret("refresh-token-plain"),
      scopes: "openid email https://www.googleapis.com/auth/webmasters.readonly",
      revokedAt: null,
    });
    findActivePropertyConnectionMock.mockResolvedValue({
      id: "connection-1",
      websiteId: WEBSITE_ID,
      observeOwnerId: "owner-1",
      googleIdentityId: "identity-1",
      propertyUri: "sc-domain:foundfy.me",
      propertyType: "domain",
      permissionLevel: "siteOwner",
      confirmationSource: "user",
      status: "connected",
    });
    insertRunningSearchSyncMock.mockResolvedValue({
      id: "sync-1",
      websiteId: WEBSITE_ID,
      propertyConnectionId: "connection-1",
      periodStart: "2026-08-28",
      periodEnd: "2026-09-24",
      status: "running",
      source: "google_search_console_search_analytics",
      startedAt: "2026-09-24T10:00:00.000Z",
      completedAt: null,
      errorCode: null,
      siteRowCount: 0,
      pageRowCount: 0,
      queryRowCount: 0,
      queryPageRowCount: 0,
      pagesTruncated: false,
      queriesTruncated: false,
      queryPagesTruncated: false,
    });
    insertSearchEvidenceMock.mockResolvedValue(undefined);
    completeSearchSyncMock.mockImplementation(async (input: { id: string }) => ({
      id: input.id,
      websiteId: WEBSITE_ID,
      propertyConnectionId: "connection-1",
      periodStart: "2026-08-28",
      periodEnd: "2026-09-24",
      status: "completed",
      source: "google_search_console_search_analytics",
      startedAt: "2026-09-24T10:00:00.000Z",
      completedAt: "2026-09-24T10:00:02.000Z",
      errorCode: null,
      siteRowCount: 1,
      pageRowCount: 2,
      queryRowCount: 1,
      queryPageRowCount: 1,
      pagesTruncated: false,
      queriesTruncated: false,
      queryPagesTruncated: false,
    }));
    failSearchSyncMock.mockResolvedValue(undefined);
    deleteEvidenceForSyncMock.mockResolvedValue(undefined);
    refreshGoogleAccessTokenMock.mockResolvedValue("short-lived-access");
    listFoundfyPagesForMappingMock.mockResolvedValue([
      {
        id: "page-home",
        requestedUrl: "https://www.foundfy.me/",
        finalUrl: "https://www.foundfy.me/",
        canonical: "https://www.foundfy.me/",
      },
    ]);
    fetchSearchAnalyticsDatasetsMock.mockResolvedValue({
      site: {
        rows: [{ keys: [], clicks: 36, impressions: 1240, ctr: 0.029, position: 12.1 }],
        truncated: false,
        responseAggregationType: "byProperty",
      },
      pages: {
        rows: [
          {
            keys: ["https://www.foundfy.me/"],
            clicks: 30,
            impressions: 1000,
            ctr: 0.03,
            position: 8.2,
          },
          {
            keys: ["https://www.foundfy.me/unseen"],
            clicks: 6,
            impressions: 240,
            ctr: 0.025,
            position: 18,
          },
        ],
        truncated: false,
        responseAggregationType: "byPage",
      },
      queries: {
        rows: [
          { keys: ["foundfy"], clicks: 12, impressions: 400, ctr: 0.03, position: 7.1 },
        ],
        truncated: false,
        responseAggregationType: null,
      },
      queryPages: {
        rows: [
          {
            keys: ["foundfy", "https://www.foundfy.me/"],
            clicks: 10,
            impressions: 350,
            ctr: 0.0286,
            position: 6.4,
          },
        ],
        truncated: false,
        responseAggregationType: null,
      },
    });
  });

  it("requires an owner session", async () => {
    await expect(
      syncSearchAnalytics({ websiteId: WEBSITE_ID, sessionToken: null }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchSearchAnalyticsDatasetsMock).not.toHaveBeenCalled();
  });

  it("denies a session minted for a different website", async () => {
    findOwnerSessionByTokenHashMock.mockResolvedValue({
      id: "session-1",
      googleIdentityId: "identity-1",
      websiteId: OTHER_WEBSITE_ID,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    await expect(
      syncSearchAnalytics({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("requires an active Search Console property binding", async () => {
    findActivePropertyConnectionMock.mockResolvedValue(null);

    await expect(
      syncSearchAnalytics({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(SearchConsoleNotConnectedError);
  });

  it("keeps the refresh token on the server", async () => {
    const view = await syncSearchAnalytics({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
      now: new Date("2026-09-24T18:00:00.000Z"),
    });

    expect(refreshGoogleAccessTokenMock).toHaveBeenCalledWith("refresh-token-plain");
    expect(JSON.stringify(view)).not.toMatch(/refresh-token-plain|short-lived-access/i);
  });

  it("surfaces token refresh failure as expired Google access", async () => {
    refreshGoogleAccessTokenMock.mockRejectedValue(new GoogleAuthExpiredError());

    await expect(
      syncSearchAnalytics({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(GoogleAuthExpiredError);
    expect(failSearchSyncMock).toHaveBeenCalledWith({
      id: "sync-1",
      errorCode: "auth_expired",
    });
    expect(completeSearchSyncMock).not.toHaveBeenCalled();
  });

  it("records a Google dataset failure as a failed sync", async () => {
    fetchSearchAnalyticsDatasetsMock.mockRejectedValue(new GoogleSearchAnalyticsError("partial"));

    await expect(
      syncSearchAnalytics({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(GoogleSearchAnalyticsError);
    expect(completeSearchSyncMock).not.toHaveBeenCalled();
    expect(failSearchSyncMock).toHaveBeenCalledWith({
      id: "sync-1",
      errorCode: "partial",
    });
  });

  it("ingests site, page, query, and query-page evidence without naive site totals", async () => {
    const view = await syncSearchAnalytics({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
      now: new Date("2026-09-24T18:00:00.000Z"),
    });

    const rows = insertSearchEvidenceMock.mock.calls[0]?.[0] as Array<{
      evidenceType: string;
      pageUrl: string | null;
      pageId: string | null;
      queryText: string | null;
    }>;

    expect(rows.map((row) => row.evidenceType)).toEqual([
      "site",
      "page",
      "page",
      "query",
      "query_page",
    ]);
    expect(rows.find((row) => row.pageUrl === "https://www.foundfy.me/")?.pageId).toBe(
      "page-home",
    );
    expect(rows.find((row) => row.pageUrl === "https://www.foundfy.me/unseen")?.pageId).toBeNull();
    expect(rows.find((row) => row.evidenceType === "query")?.queryText).toBe("foundfy");
    expect(view.summary.impressions).toBe(1240);
    expect(view.summary.clicks).toBe(36);
    expect(view.summary.pagesSeen).toBe(2);
    expect(view.summary.queriesReported).toBe(1);
    expect(view.summary.impressions).not.toBe(1240 + 1000);
    expect(fetchSearchAnalyticsDatasetsMock.mock.calls[0]?.[0]).toMatchObject({
      propertyUri: "sc-domain:foundfy.me",
    });
    expect(completeSearchSyncMock).toHaveBeenCalled();
  });

  it("treats an empty Google response as successful empty evidence", async () => {
    fetchSearchAnalyticsDatasetsMock.mockResolvedValue({
      site: emptyDataset(),
      pages: emptyDataset(),
      queries: emptyDataset(),
      queryPages: emptyDataset(),
    });

    const view = await syncSearchAnalytics({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(view.empty).toBe(true);
    expect(view.status).toBe("completed");
    expect(insertSearchEvidenceMock).toHaveBeenCalledWith([]);
    expect(completeSearchSyncMock).toHaveBeenCalled();
  });

  it("does not treat a partial failure as current successful evidence", async () => {
    fetchSearchAnalyticsDatasetsMock.mockRejectedValue(new Error("Google unavailable"));

    await expect(
      syncSearchAnalytics({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeTruthy();
    expect(completeSearchSyncMock).not.toHaveBeenCalled();
    expect(failSearchSyncMock).toHaveBeenCalledWith({
      id: "sync-1",
      errorCode: "unavailable",
    });
  });

  it("records a Google dataset failure as a failed sync", async () => {
    fetchSearchAnalyticsDatasetsMock.mockRejectedValue(new GoogleSearchAnalyticsError("partial"));

    await expect(
      syncSearchAnalytics({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(GoogleSearchAnalyticsError);
    expect(completeSearchSyncMock).not.toHaveBeenCalled();
    expect(failSearchSyncMock).toHaveBeenCalledWith({
      id: "sync-1",
      errorCode: "partial",
    });
  });

  it("creates a new sync on retry instead of mutating a failed one into success", async () => {
    insertRunningSearchSyncMock
      .mockResolvedValueOnce({ id: "sync-fail", status: "running" })
      .mockResolvedValueOnce({ id: "sync-ok", status: "running" });
    fetchSearchAnalyticsDatasetsMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        site: emptyDataset(),
        pages: emptyDataset(),
        queries: emptyDataset(),
        queryPages: emptyDataset(),
      });
    completeSearchSyncMock.mockImplementation(async (input: { id: string }) => ({
      id: input.id,
      websiteId: WEBSITE_ID,
      propertyConnectionId: "connection-1",
      periodStart: "2026-08-28",
      periodEnd: "2026-09-24",
      status: "completed",
      source: "google_search_console_search_analytics",
      startedAt: "2026-09-24T10:00:00.000Z",
      completedAt: "2026-09-24T10:00:02.000Z",
      errorCode: null,
      siteRowCount: 0,
      pageRowCount: 0,
      queryRowCount: 0,
      queryPageRowCount: 0,
      pagesTruncated: false,
      queriesTruncated: false,
      queryPagesTruncated: false,
    }));

    await expect(
      syncSearchAnalytics({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeTruthy();
    const retry = await syncSearchAnalytics({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(failSearchSyncMock).toHaveBeenCalledWith({
      id: "sync-fail",
      errorCode: "unavailable",
    });
    expect(completeSearchSyncMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sync-ok" }),
    );
    expect(retry.status).toBe("completed");
  });
});
