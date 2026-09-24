import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "./crypto";
import { GoogleAuthExpiredError, UnverifiedPropertyError } from "./types";

const getWebsiteByIdMock = vi.fn();
const findOwnerSessionByTokenHashMock = vi.fn();
const findActiveObserveOwnerMock = vi.fn();
const findGoogleIdentityByIdMock = vi.fn();
const findGoogleOAuthTokenByIdMock = vi.fn();
const findActivePropertyConnectionMock = vi.fn();
const upsertActivePropertyConnectionMock = vi.fn();
const refreshGoogleAccessTokenMock = vi.fn();
const listSearchConsoleSitesMock = vi.fn();

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
  upsertActivePropertyConnection: (...args: unknown[]) =>
    upsertActivePropertyConnectionMock(...args),
}));

const deleteSearchAnalyticsForWebsiteMock = vi.fn();
const deleteDecisionEngineForWebsiteMock = vi.fn();

vi.mock("./db-search", () => ({
  deleteSearchAnalyticsForWebsite: (...args: unknown[]) =>
    deleteSearchAnalyticsForWebsiteMock(...args),
}));

vi.mock("@/lib/decisions/db", () => ({
  deleteDecisionEngineForWebsite: (...args: unknown[]) =>
    deleteDecisionEngineForWebsiteMock(...args),
}));

vi.mock("./google", () => ({
  refreshGoogleAccessToken: (...args: unknown[]) => refreshGoogleAccessTokenMock(...args),
  listSearchConsoleSites: (...args: unknown[]) => listSearchConsoleSitesMock(...args),
}));

import { bindObserveProperty, listObserveProperties } from "./properties";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const SESSION_TOKEN = "owner-session-token";
const ORIGINAL_ENV = { ...process.env };

describe("Search Console property discovery and binding", () => {
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
    refreshGoogleAccessTokenMock.mockResolvedValue("short-lived-access");
    findActivePropertyConnectionMock.mockResolvedValue(null);
    deleteSearchAnalyticsForWebsiteMock.mockResolvedValue(undefined);
    deleteDecisionEngineForWebsiteMock.mockResolvedValue(undefined);
    listSearchConsoleSitesMock.mockResolvedValue([
      { siteUrl: "sc-domain:foundfy.me", permissionLevel: "siteOwner" },
      { siteUrl: "https://www.foundfy.me/", permissionLevel: "siteFullUser" },
      { siteUrl: "https://other.example/", permissionLevel: "siteOwner" },
    ]);
    upsertActivePropertyConnectionMock.mockImplementation(async (input: { propertyUri: string }) => ({
      id: "connection-1",
      websiteId: WEBSITE_ID,
      observeOwnerId: "owner-1",
      googleIdentityId: "identity-1",
      propertyUri: input.propertyUri,
      propertyType: input.propertyUri.startsWith("sc-domain:") ? "domain" : "url_prefix",
      permissionLevel: "siteOwner",
      confirmationSource: "user",
      status: "connected",
    }));
  });

  it("requires an owner session to list properties", async () => {
    await expect(
      listObserveProperties({ websiteId: WEBSITE_ID, sessionToken: null }),
    ).rejects.toMatchObject({ status: 401 });
    expect(listSearchConsoleSitesMock).not.toHaveBeenCalled();
  });

  it("denies the wrong Google identity", async () => {
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-other",
      googleOAuthTokenId: "token-other",
      status: "google_connected",
    });

    await expect(
      listObserveProperties({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("surfaces a refresh-token failure as expired Google access", async () => {
    refreshGoogleAccessTokenMock.mockRejectedValue(new GoogleAuthExpiredError());

    await expect(
      listObserveProperties({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toBeInstanceOf(GoogleAuthExpiredError);
  });

  it("decrypts the refresh token only on the server and never returns it", async () => {
    const list = await listObserveProperties({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(refreshGoogleAccessTokenMock).toHaveBeenCalledWith("refresh-token-plain");
    expect(JSON.stringify(list)).not.toMatch(/refresh-token-plain|ciphertext|short-lived-access/);
    expect(list.recommendedSiteUrl).toBe("sc-domain:foundfy.me");
    expect(list.likely.map((property) => property.siteUrl)).toEqual([
      "sc-domain:foundfy.me",
      "https://www.foundfy.me/",
    ]);
    expect(list.other.map((property) => property.siteUrl)).toEqual(["https://other.example/"]);
  });

  it("rejects an arbitrary unverified property", async () => {
    await expect(
      bindObserveProperty({
        websiteId: WEBSITE_ID,
        sessionToken: SESSION_TOKEN,
        siteUrl: "sc-domain:someone-elses-site.com",
      }),
    ).rejects.toBeInstanceOf(UnverifiedPropertyError);
    expect(upsertActivePropertyConnectionMock).not.toHaveBeenCalled();
  });

  it("persists only an explicit, currently accessible property", async () => {
    const bound = await bindObserveProperty({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
      siteUrl: "sc-domain:foundfy.me",
    });

    expect(bound.siteUrl).toBe("sc-domain:foundfy.me");
    expect(upsertActivePropertyConnectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        websiteId: WEBSITE_ID,
        observeOwnerId: "owner-1",
        googleIdentityId: "identity-1",
        propertyUri: "sc-domain:foundfy.me",
        propertyType: "domain",
      }),
    );
  });

  it("re-verifies Google properties when changing the binding", async () => {
    await bindObserveProperty({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
      siteUrl: "https://www.foundfy.me/",
    });

    expect(listSearchConsoleSitesMock).toHaveBeenCalledTimes(1);
    expect(upsertActivePropertyConnectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ propertyUri: "https://www.foundfy.me/" }),
    );
  });

  it("deletes Search Analytics evidence when the bound property URI changes", async () => {
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

    await bindObserveProperty({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
      siteUrl: "https://www.foundfy.me/",
    });

    expect(deleteDecisionEngineForWebsiteMock).toHaveBeenCalledWith(WEBSITE_ID);
    expect(deleteSearchAnalyticsForWebsiteMock).toHaveBeenCalledWith(WEBSITE_ID);
  });
});
