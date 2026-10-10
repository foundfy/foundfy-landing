import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchConsoleNotConnectedError } from "@/lib/gsc/types";

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

vi.mock("@/lib/gsc/db", () => ({
  findOwnerSessionByTokenHash: (...args: unknown[]) => findOwnerSessionByTokenHashMock(...args),
  findActiveObserveOwner: (...args: unknown[]) => findActiveObserveOwnerMock(...args),
  findGoogleIdentityById: (...args: unknown[]) => findGoogleIdentityByIdMock(...args),
  findGoogleOAuthTokenById: (...args: unknown[]) => findGoogleOAuthTokenByIdMock(...args),
  findActivePropertyConnection: (...args: unknown[]) =>
    findActivePropertyConnectionMock(...args),
}));

vi.mock("@/lib/gsc/db-search", () => ({
  findLatestCompletedSearchSync: (...args: unknown[]) =>
    findLatestCompletedSearchSyncMock(...args),
  listEvidenceForSync: (...args: unknown[]) => listEvidenceForSyncMock(...args),
}));

import { loadQueryOpportunities } from "./load";

const WEBSITE_ID = "cb01711e-7945-4a88-9998-e78fec411509";
const SESSION_TOKEN = "owner-session-token";

describe("Opportunity Discovery v0 load", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GSC_SESSION_SECRET = "session-secret";
    getWebsiteByIdMock.mockResolvedValue({
      id: WEBSITE_ID,
      hostname: "dbhobby.com",
      displayUrl: "https://dbhobby.com/",
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
      email: "owner@dbhobby.com",
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
      propertyUri: "sc-domain:dbhobby.com",
      propertyType: "domain",
      permissionLevel: "siteOwner",
      confirmationSource: "user",
      status: "connected",
    });
  });

  it("returns an empty no-query state from a completed sync", async () => {
    findLatestCompletedSearchSyncMock.mockResolvedValue({
      id: "sync-empty",
      websiteId: WEBSITE_ID,
      propertyConnectionId: "connection-1",
      periodStart: "2026-09-02",
      periodEnd: "2026-09-29",
      status: "completed",
      source: "google_search_console_search_analytics",
      startedAt: "2026-09-29T22:00:00.000Z",
      completedAt: "2026-09-29T22:01:08.000Z",
      errorCode: null,
      siteRowCount: 1,
      pageRowCount: 1,
      queryRowCount: 0,
      queryPageRowCount: 0,
      pagesTruncated: false,
      queriesTruncated: false,
      queryPagesTruncated: false,
    });
    listEvidenceForSyncMock.mockResolvedValue([
      {
        evidenceType: "site",
        queryText: null,
        pageUrl: null,
        pageId: null,
        clicks: 0,
        impressions: 1,
        ctr: 0,
        position: 3,
      },
    ]);

    const view = await loadQueryOpportunities({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(view.status).toBe("completed");
    expect(view.empty).toBe(true);
    expect(view.emptyReason).toBe("no_queries");
    expect(view.opportunities).toEqual([]);
    expect(view.truncated.queries).toBe(false);
  });

  it("derives opportunities from the latest completed sync and discloses truncation", async () => {
    findLatestCompletedSearchSyncMock.mockResolvedValue({
      id: "sync-ok",
      websiteId: WEBSITE_ID,
      propertyConnectionId: "connection-1",
      periodStart: "2026-09-11",
      periodEnd: "2026-10-08",
      status: "completed",
      source: "google_search_console_search_analytics",
      startedAt: "2026-10-08T20:00:00.000Z",
      completedAt: "2026-10-08T20:28:46.000Z",
      errorCode: null,
      siteRowCount: 1,
      pageRowCount: 100,
      queryRowCount: 100,
      queryPageRowCount: 250,
      pagesTruncated: true,
      queriesTruncated: true,
      queryPagesTruncated: true,
    });
    listEvidenceForSyncMock.mockResolvedValue([
      {
        evidenceType: "query",
        queryText: "cianotipo",
        pageUrl: null,
        pageId: null,
        clicks: 0,
        impressions: 187,
        ctr: 0,
        position: 2.8,
      },
      {
        evidenceType: "query",
        queryText: "dbhobby",
        pageUrl: null,
        pageId: null,
        clicks: 3,
        impressions: 41,
        ctr: 0.07,
        position: 5.4,
      },
      {
        evidenceType: "query_page",
        queryText: "cianotipo",
        pageUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
        pageId: null,
        clicks: 0,
        impressions: 186,
        ctr: 0,
        position: 2.8,
      },
      {
        evidenceType: "query_page",
        queryText: "dbhobby",
        pageUrl: "https://www.dbhobby.com/ca/taxonomy/term/358",
        pageId: null,
        clicks: 1,
        impressions: 17,
        ctr: 0,
        position: 4,
      },
    ]);

    const view = await loadQueryOpportunities({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(view.opportunities.map((card) => card.query)).toEqual(["cianotipo"]);
    expect(view.truncated).toEqual({ queries: true, queryPages: true });
    expect(JSON.stringify(view)).not.toMatch(/99\.5|share|% of visibil/i);
    expect(listEvidenceForSyncMock).toHaveBeenCalledWith("sync-ok");
  });

  it("denies load without an owner session", async () => {
    await expect(
      loadQueryOpportunities({ websiteId: WEBSITE_ID, sessionToken: null }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("denies load without Search Console", async () => {
    findActivePropertyConnectionMock.mockResolvedValue(null);

    await expect(
      loadQueryOpportunities({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(SearchConsoleNotConnectedError);
  });
});
