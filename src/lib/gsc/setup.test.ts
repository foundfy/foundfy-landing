import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "./crypto";

const requireObserveOwnerMock = vi.fn();
const addSearchConsoleSiteMock = vi.fn();
const listSearchConsoleSitesMock = vi.fn();
const refreshGoogleAccessTokenMock = vi.fn();
const getDnsTxtVerificationTokenMock = vi.fn();
const insertDnsTxtVerificationMock = vi.fn();
const bindObservePropertyMock = vi.fn();
const findActivePropertyConnectionMock = vi.fn();
const findLatestCompletedSearchSyncMock = vi.fn();
const findRunningSearchSyncMock = vi.fn();
const syncSearchAnalyticsMock = vi.fn();
const removeGoogleDerivedOwnerDataForWebsiteMock = vi.fn();

vi.mock("./observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwnerMock(...args),
}));

vi.mock("./google", () => ({
  addSearchConsoleSite: (...args: unknown[]) => addSearchConsoleSiteMock(...args),
  listSearchConsoleSites: (...args: unknown[]) => listSearchConsoleSitesMock(...args),
  refreshGoogleAccessToken: (...args: unknown[]) => refreshGoogleAccessTokenMock(...args),
}));

vi.mock("./site-verification", () => ({
  getDnsTxtVerificationToken: (...args: unknown[]) => getDnsTxtVerificationTokenMock(...args),
  insertDnsTxtVerification: (...args: unknown[]) => insertDnsTxtVerificationMock(...args),
}));

vi.mock("./properties", () => ({
  bindObserveProperty: (...args: unknown[]) => bindObservePropertyMock(...args),
}));

vi.mock("./db", () => ({
  findActivePropertyConnection: (...args: unknown[]) =>
    findActivePropertyConnectionMock(...args),
}));

vi.mock("./db-search", () => ({
  findLatestCompletedSearchSync: (...args: unknown[]) =>
    findLatestCompletedSearchSyncMock(...args),
  findRunningSearchSync: (...args: unknown[]) => findRunningSearchSyncMock(...args),
}));

vi.mock("./sync", () => ({
  syncSearchAnalytics: (...args: unknown[]) => syncSearchAnalyticsMock(...args),
}));

vi.mock("@/lib/actions/google-privacy", () => ({
  removeGoogleDerivedOwnerDataForWebsite: (...args: unknown[]) =>
    removeGoogleDerivedOwnerDataForWebsiteMock(...args),
}));

import { setupSearchPresence, verifySearchPresence } from "./setup";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const SESSION_TOKEN = "owner-session-token";
const ORIGINAL_ENV = { ...process.env };

const SETUP_SCOPES =
  "https://www.googleapis.com/auth/siteverification.verify_only https://www.googleapis.com/auth/webmasters";

describe("C0 Search Presence setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.GSC_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
    requireObserveOwnerMock.mockResolvedValue({
      website: {
        id: WEBSITE_ID,
        hostname: "gez.studio",
        displayUrl: "https://gez.studio/",
      },
      owner: { id: "owner-1", googleIdentityId: "identity-1" },
      token: {
        id: "token-1",
        googleIdentityId: "identity-1",
        refreshTokenCiphertext: encryptSecret("refresh-token-plain"),
        scopes: SETUP_SCOPES,
        revokedAt: null,
      },
    });
    refreshGoogleAccessTokenMock.mockResolvedValue("access-token");
    getDnsTxtVerificationTokenMock.mockResolvedValue("google-site-verification=txt");
    addSearchConsoleSiteMock.mockResolvedValue("added");
    bindObservePropertyMock.mockResolvedValue({
      siteUrl: "sc-domain:gez.studio",
      propertyType: "domain",
      permissionLevel: "siteOwner",
      match: "exact_domain",
    });
    findActivePropertyConnectionMock.mockResolvedValue({
      id: "connection-1",
      propertyUri: "sc-domain:gez.studio",
    });
    findRunningSearchSyncMock.mockResolvedValue(null);
    findLatestCompletedSearchSyncMock.mockResolvedValue(null);
    syncSearchAnalyticsMock.mockResolvedValue({
      status: "completed",
      empty: true,
      pages: [],
      queries: [],
    });
  });

  it("ignores a browser-supplied domain and adds the server-derived Domain property", async () => {
    listSearchConsoleSitesMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { siteUrl: "sc-domain:gez.studio", permissionLevel: "siteUnverifiedUser" },
      ]);

    const view = await setupSearchPresence({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
      requestedDomain: "sc-domain:evil.example",
    });

    expect(addSearchConsoleSiteMock).toHaveBeenCalledWith(
      "access-token",
      "sc-domain:gez.studio",
    );
    expect(addSearchConsoleSiteMock).not.toHaveBeenCalledWith(
      "access-token",
      "sc-domain:evil.example",
    );
    expect(listSearchConsoleSitesMock).toHaveBeenCalledTimes(2);
    expect(view.domainPropertyUri).toBe("sc-domain:gez.studio");
  });

  it("skips sites.add when a usable matching property already exists", async () => {
    listSearchConsoleSitesMock.mockResolvedValue([
      { siteUrl: "https://gez.studio/", permissionLevel: "siteFullUser" },
    ]);

    const view = await setupSearchPresence({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(addSearchConsoleSiteMock).not.toHaveBeenCalled();
    expect(view.presenceState).toBe("MATCHING_GSC_PROPERTY_AVAILABLE");
  });

  it("skips sites.add for the exact host-Domain unverified property and fetches a DNS TXT token", async () => {
    listSearchConsoleSitesMock.mockResolvedValue([
      { siteUrl: "sc-domain:gez.studio", permissionLevel: "siteUnverifiedUser" },
    ]);

    const view = await setupSearchPresence({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(addSearchConsoleSiteMock).not.toHaveBeenCalled();
    expect(getDnsTxtVerificationTokenMock).toHaveBeenCalledWith("access-token", "gez.studio");
    expect(view.presenceState).toBe("PROPERTY_ADDED_VERIFICATION_PENDING");
    expect(view.dnsTxtToken).toBe("google-site-verification=txt");
  });

  it("does not skip Domain creation because of an unverified URL-prefix property", async () => {
    listSearchConsoleSitesMock
      .mockResolvedValueOnce([
        { siteUrl: "https://gez.studio/", permissionLevel: "siteUnverifiedUser" },
      ])
      .mockResolvedValueOnce([
        { siteUrl: "https://gez.studio/", permissionLevel: "siteUnverifiedUser" },
        { siteUrl: "sc-domain:gez.studio", permissionLevel: "siteUnverifiedUser" },
      ]);

    const view = await setupSearchPresence({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(addSearchConsoleSiteMock).toHaveBeenCalledWith(
      "access-token",
      "sc-domain:gez.studio",
    );
    expect(view.presenceState).toBe("PROPERTY_ADDED_VERIFICATION_PENDING");
  });

  it("requires setup capabilities before creating a Domain property", async () => {
    requireObserveOwnerMock.mockResolvedValue({
      website: {
        id: WEBSITE_ID,
        hostname: "gez.studio",
        displayUrl: "https://gez.studio/",
      },
      owner: { id: "owner-1", googleIdentityId: "identity-1" },
      token: {
        id: "token-1",
        googleIdentityId: "identity-1",
        refreshTokenCiphertext: encryptSecret("refresh-token-plain"),
        scopes: "openid email https://www.googleapis.com/auth/webmasters.readonly",
        revokedAt: null,
      },
    });
    listSearchConsoleSitesMock.mockResolvedValue([]);

    const view = await setupSearchPresence({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(addSearchConsoleSiteMock).not.toHaveBeenCalled();
    expect(view.presenceState).toBe("PROPERTY_SETUP_AUTH_REQUIRED");
  });

  it("uses re-list after sites.add rather than the add HTTP response", async () => {
    listSearchConsoleSitesMock.mockResolvedValue([]);

    await expect(
      setupSearchPresence({
        websiteId: WEBSITE_ID,
        sessionToken: SESSION_TOKEN,
      }),
    ).rejects.toMatchObject({
      name: "SearchPresenceGoogleError",
      kind: "invalid",
    });

    expect(listSearchConsoleSitesMock).toHaveBeenCalledTimes(2);
    expect(getDnsTxtVerificationTokenMock).not.toHaveBeenCalled();
  });

  it("continues from live Google state when sites.add 409 is followed by the authoritative Domain property", async () => {
    addSearchConsoleSiteMock.mockResolvedValue("conflict");
    listSearchConsoleSitesMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { siteUrl: "sc-domain:gez.studio", permissionLevel: "siteUnverifiedUser" },
      ]);

    const view = await setupSearchPresence({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(addSearchConsoleSiteMock).toHaveBeenCalledWith(
      "access-token",
      "sc-domain:gez.studio",
    );
    expect(view.presenceState).toBe("PROPERTY_ADDED_VERIFICATION_PENDING");
    expect(view.dnsTxtToken).toBe("google-site-verification=txt");
  });

  it("does not treat sites.add 409 alone as verification pending or connected", async () => {
    addSearchConsoleSiteMock.mockResolvedValue("conflict");
    listSearchConsoleSitesMock.mockResolvedValue([]);

    await expect(
      setupSearchPresence({
        websiteId: WEBSITE_ID,
        sessionToken: SESSION_TOKEN,
      }),
    ).rejects.toMatchObject({
      name: "SearchPresenceGoogleError",
      kind: "invalid",
      status: 409,
    });
    expect(getDnsTxtVerificationTokenMock).not.toHaveBeenCalled();
    expect(bindObservePropertyMock).not.toHaveBeenCalled();
  });

  it("does not persist the DNS TXT token", async () => {
    listSearchConsoleSitesMock.mockResolvedValue([
      { siteUrl: "sc-domain:gez.studio", permissionLevel: "siteUnverifiedUser" },
    ]);

    const view = await setupSearchPresence({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(JSON.stringify(view)).toContain("google-site-verification=txt");
    expect(findActivePropertyConnectionMock).not.toHaveBeenCalled();
  });

  it("verifies the server-derived domain and binds only after live usable permission", async () => {
    listSearchConsoleSitesMock
      .mockResolvedValueOnce([
        { siteUrl: "sc-domain:gez.studio", permissionLevel: "siteUnverifiedUser" },
      ])
      .mockResolvedValueOnce([
        { siteUrl: "sc-domain:gez.studio", permissionLevel: "siteOwner" },
      ]);
    insertDnsTxtVerificationMock.mockResolvedValue("verified");

    const view = await verifySearchPresence({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
      requestedDomain: "example.com",
      requestedToken: "forged-token",
    });

    expect(insertDnsTxtVerificationMock).toHaveBeenCalledWith("access-token", "gez.studio");
    expect(bindObservePropertyMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
      siteUrl: "sc-domain:gez.studio",
    });
    expect(syncSearchAnalyticsMock).toHaveBeenCalledTimes(1);
    expect(view.presenceState).toBe("GSC_CONNECTED");
    expect(view.searchAnalytics?.empty).toBe(true);
  });

  it("does not treat auth, permission, quota, or 5xx verification failures as DNS pending", async () => {
    const { GoogleAuthExpiredError, SearchPresenceGoogleError } = await import("./types");
    listSearchConsoleSitesMock.mockResolvedValue([
      { siteUrl: "sc-domain:gez.studio", permissionLevel: "siteUnverifiedUser" },
    ]);

    insertDnsTxtVerificationMock.mockRejectedValueOnce(new GoogleAuthExpiredError());
    await expect(
      verifySearchPresence({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(GoogleAuthExpiredError);

    insertDnsTxtVerificationMock.mockRejectedValueOnce(
      new SearchPresenceGoogleError("permission", "Foundfy needs permission to set up Search Console for this website.", 403),
    );
    await expect(
      verifySearchPresence({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toMatchObject({ kind: "permission" });

    insertDnsTxtVerificationMock.mockRejectedValueOnce(
      new SearchPresenceGoogleError("transient", "Google is temporarily unavailable. You can try again.", 429),
    );
    await expect(
      verifySearchPresence({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toMatchObject({ kind: "transient" });

    insertDnsTxtVerificationMock.mockRejectedValueOnce(
      new SearchPresenceGoogleError("transient", "Google is temporarily unavailable. You can try again.", 503),
    );
    await expect(
      verifySearchPresence({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toMatchObject({ kind: "transient" });

    insertDnsTxtVerificationMock.mockRejectedValueOnce(
      new SearchPresenceGoogleError("invalid", "Search Console setup couldn't be completed right now.", 418),
    );
    await expect(
      verifySearchPresence({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toMatchObject({ kind: "invalid" });

    expect(bindObservePropertyMock).not.toHaveBeenCalled();
  });

  it("stays verification pending when live list is still unverified", async () => {
    listSearchConsoleSitesMock.mockResolvedValue([
      { siteUrl: "sc-domain:gez.studio", permissionLevel: "siteUnverifiedUser" },
    ]);
    insertDnsTxtVerificationMock.mockResolvedValue("pending");

    const view = await verifySearchPresence({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(bindObservePropertyMock).not.toHaveBeenCalled();
    expect(view.presenceState).toBe("PROPERTY_ADDED_VERIFICATION_PENDING");
    expect(view.retryMessage).toMatch(/need more time/i);
  });

  it("does not treat an unverified URL-prefix property as Domain verification state", async () => {
    listSearchConsoleSitesMock.mockResolvedValue([
      { siteUrl: "https://gez.studio/", permissionLevel: "siteUnverifiedUser" },
    ]);

    const view = await verifySearchPresence({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(insertDnsTxtVerificationMock).not.toHaveBeenCalled();
    expect(bindObservePropertyMock).not.toHaveBeenCalled();
    expect(view.presenceState).not.toBe("PROPERTY_ADDED_VERIFICATION_PENDING");
    expect(view.presenceState).not.toBe("GSC_CONNECTED");
  });

  it("starts the existing Search Analytics sync only once on first C0 bind", async () => {
    listSearchConsoleSitesMock.mockResolvedValue([
      { siteUrl: "sc-domain:gez.studio", permissionLevel: "siteOwner" },
    ]);

    await verifySearchPresence({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(syncSearchAnalyticsMock).toHaveBeenCalledTimes(1);
    findLatestCompletedSearchSyncMock.mockResolvedValue({ id: "sync-1", status: "completed" });

    listSearchConsoleSitesMock.mockResolvedValue([
      { siteUrl: "sc-domain:gez.studio", permissionLevel: "siteOwner" },
    ]);
    await verifySearchPresence({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });
    expect(syncSearchAnalyticsMock).toHaveBeenCalledTimes(1);
  });
});
