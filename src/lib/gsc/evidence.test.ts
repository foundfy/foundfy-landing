import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchConsoleNotConnectedError } from "./types";

const getWebsiteByIdMock = vi.fn();
const findOwnerSessionByTokenHashMock = vi.fn();
const findActiveObserveOwnerMock = vi.fn();
const findGoogleIdentityByIdMock = vi.fn();
const findGoogleOAuthTokenByIdMock = vi.fn();
const findActivePropertyConnectionMock = vi.fn();
const findLatestCompletedSearchSyncMock = vi.fn();
const listEvidenceForSyncMock = vi.fn();

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

vi.mock("./db-search", () => ({
  findLatestCompletedSearchSync: (...args: unknown[]) =>
    findLatestCompletedSearchSyncMock(...args),
  listEvidenceForSync: (...args: unknown[]) => listEvidenceForSyncMock(...args),
}));

import { loadSearchAnalyticsEvidence } from "./evidence";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const SESSION_TOKEN = "owner-session-token";

describe("Search Analytics evidence read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      googleSub: "sub",
      email: "hello@foundfy.me",
    });
    findGoogleOAuthTokenByIdMock.mockResolvedValue({
      id: "token-1",
      googleIdentityId: "identity-1",
      encryptionKeyId: "v1",
      refreshTokenCiphertext: "cipher",
      scopes: "openid",
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
  });

  it("returns not_synced when there is no completed sync", async () => {
    findLatestCompletedSearchSyncMock.mockResolvedValue(null);

    const view = await loadSearchAnalyticsEvidence({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(view.status).toBe("not_synced");
    expect(view.empty).toBe(true);
    expect(listEvidenceForSyncMock).not.toHaveBeenCalled();
  });

  it("ignores failed syncs and only reads the latest completed set", async () => {
    findLatestCompletedSearchSyncMock.mockResolvedValue({
      id: "sync-ok",
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
      pageRowCount: 1,
      queryRowCount: 1,
      queryPageRowCount: 0,
      pagesTruncated: false,
      queriesTruncated: false,
      queryPagesTruncated: false,
    });
    listEvidenceForSyncMock.mockResolvedValue([
      {
        evidenceType: "site",
        pageUrl: null,
        pageId: null,
        queryText: null,
        clicks: 36,
        impressions: 1240,
        ctr: 0.029,
        position: 12.1,
      },
      {
        evidenceType: "page",
        pageUrl: "https://www.foundfy.me/",
        pageId: "page-home",
        queryText: null,
        clicks: 30,
        impressions: 1000,
        ctr: 0.03,
        position: 8.2,
      },
      {
        evidenceType: "query",
        pageUrl: null,
        pageId: null,
        queryText: "foundfy",
        clicks: 12,
        impressions: 400,
        ctr: 0.03,
        position: 7.1,
      },
    ]);

    const view = await loadSearchAnalyticsEvidence({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(view.status).toBe("completed");
    expect(view.summary.impressions).toBe(1240);
    expect(view.pages).toHaveLength(1);
    expect(view.queries[0]?.query).toBe("foundfy");
    expect(findLatestCompletedSearchSyncMock).toHaveBeenCalledWith(WEBSITE_ID, "connection-1");
  });

  it("denies evidence without an owner session", async () => {
    await expect(
      loadSearchAnalyticsEvidence({ websiteId: WEBSITE_ID, sessionToken: null }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("denies evidence without an active property binding", async () => {
    findActivePropertyConnectionMock.mockResolvedValue(null);

    await expect(
      loadSearchAnalyticsEvidence({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(SearchConsoleNotConnectedError);
  });
});
