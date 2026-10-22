import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObserveAuthError } from "./types";

const getWebsiteByIdMock = vi.fn();
const findOwnerSessionByTokenHashMock = vi.fn();
const findActiveObserveOwnerMock = vi.fn();
const findGoogleIdentityByIdMock = vi.fn();
const findActivePropertyConnectionMock = vi.fn();
const revokeActivePropertyConnectionsForWebsiteMock = vi.fn();
const deleteSearchAnalyticsForWebsiteMock = vi.fn();
const deleteDecisionEngineForWebsiteMock = vi.fn();
const findGoogleOAuthTokenByIdMock = vi.fn();
const revokeObserveOwnerMock = vi.fn();
const revokeOwnerSessionsForWebsiteIdentityMock = vi.fn();
const countActiveOwnersForIdentityMock = vi.fn();
const disableGoogleOAuthTokenMock = vi.fn();
const revokeGoogleTokenMock = vi.fn();

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
  revokeActivePropertyConnectionsForWebsite: (...args: unknown[]) =>
    revokeActivePropertyConnectionsForWebsiteMock(...args),
  revokeObserveOwner: (...args: unknown[]) => revokeObserveOwnerMock(...args),
  revokeOwnerSessionsForWebsiteIdentity: (...args: unknown[]) =>
    revokeOwnerSessionsForWebsiteIdentityMock(...args),
  countActiveOwnersForIdentity: (...args: unknown[]) =>
    countActiveOwnersForIdentityMock(...args),
  disableGoogleOAuthToken: (...args: unknown[]) => disableGoogleOAuthTokenMock(...args),
}));

vi.mock("./db-search", () => ({
  deleteSearchAnalyticsForWebsite: (...args: unknown[]) =>
    deleteSearchAnalyticsForWebsiteMock(...args),
}));

vi.mock("@/lib/decisions/db", () => ({
  deleteDecisionEngineForWebsite: (...args: unknown[]) =>
    deleteDecisionEngineForWebsiteMock(...args),
}));

vi.mock("./google", () => ({
  revokeGoogleToken: (...args: unknown[]) => revokeGoogleTokenMock(...args),
}));

const removeGoogleDerivedOwnerDataForWebsiteMock = vi.fn();
vi.mock("@/lib/actions/google-privacy", () => ({
  removeGoogleDerivedOwnerDataForWebsite: (...args: unknown[]) =>
    removeGoogleDerivedOwnerDataForWebsiteMock(...args),
}));

import { encryptSecret } from "./crypto";
import { hashSessionToken } from "./cookie";
const startGoogleOAuthMock = vi.fn();
vi.mock("./oauth", () => ({
  startGoogleOAuth: (...args: unknown[]) => startGoogleOAuthMock(...args),
}));

import { disconnectObserveOwner, requireSearchConsoleConnection, resolveObserveOwnerView, switchPreBindGoogleAccount } from "./observe";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const SESSION_TOKEN = "owner-session-token";
const ORIGINAL_ENV = { ...process.env };

describe("observe owner authorization", () => {
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
      email: "jose@foundfy.me",
    });
    const ciphertext = encryptSecret("refresh-token-plain");
    findGoogleOAuthTokenByIdMock.mockResolvedValue({
      id: "token-1",
      googleIdentityId: "identity-1",
      encryptionKeyId: "v1",
      refreshTokenCiphertext: ciphertext,
      scopes: "openid email https://www.googleapis.com/auth/webmasters.readonly",
      revokedAt: null,
    });
    findActivePropertyConnectionMock.mockResolvedValue(null);
    revokeActivePropertyConnectionsForWebsiteMock.mockResolvedValue(undefined);
    deleteSearchAnalyticsForWebsiteMock.mockResolvedValue(undefined);
    deleteDecisionEngineForWebsiteMock.mockResolvedValue(undefined);
    removeGoogleDerivedOwnerDataForWebsiteMock.mockResolvedValue(undefined);
    countActiveOwnersForIdentityMock.mockResolvedValue(0);
    revokeObserveOwnerMock.mockResolvedValue(undefined);
    revokeOwnerSessionsForWebsiteIdentityMock.mockResolvedValue(undefined);
    disableGoogleOAuthTokenMock.mockResolvedValue(undefined);
    revokeGoogleTokenMock.mockResolvedValue(undefined);
  });

  it("denies the owner endpoint without a session", async () => {
    await expect(
      resolveObserveOwnerView({ websiteId: WEBSITE_ID, sessionToken: null }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("denies a session that is not the observe owner", async () => {
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-other",
      googleOAuthTokenId: "token-other",
      status: "google_connected",
    });

    await expect(
      resolveObserveOwnerView({ websiteId: WEBSITE_ID, sessionToken: SESSION_TOKEN }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("returns Google-connected state without tokens for the owner", async () => {
    const view = await resolveObserveOwnerView({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(view).toEqual({
      status: "google_connected",
      email: "jose@foundfy.me",
      propertySelected: false,
      property: null,
    });
    expect(JSON.stringify(view)).not.toMatch(/refresh-token|ciphertext|accessToken/i);
    expect(findOwnerSessionByTokenHashMock).toHaveBeenCalledWith(
      hashSessionToken(SESSION_TOKEN),
    );
  });

  it("returns Search Console connected only after a persisted property binding", async () => {
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

    const view = await resolveObserveOwnerView({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(view).toEqual({
      status: "search_console_connected",
      email: "jose@foundfy.me",
      propertySelected: true,
      property: {
        siteUrl: "sc-domain:foundfy.me",
        propertyType: "domain",
        permissionLevel: "siteOwner",
      },
    });
  });

  it("does not treat another identity's property as Search Console connected", async () => {
    findActivePropertyConnectionMock.mockResolvedValue({
      id: "connection-1",
      websiteId: WEBSITE_ID,
      observeOwnerId: "owner-other",
      googleIdentityId: "identity-other",
      propertyUri: "sc-domain:foundfy.me",
      propertyType: "domain",
      permissionLevel: "siteOwner",
      confirmationSource: "user",
      status: "connected",
    });

    const view = await resolveObserveOwnerView({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(view.status).toBe("google_connected");
    expect(view.propertySelected).toBe(false);
    expect(view.property).toBeNull();
  });

  it("requires an active property binding for Search Analytics", async () => {
    await expect(
      requireSearchConsoleConnection({
        websiteId: WEBSITE_ID,
        sessionToken: SESSION_TOKEN,
      }),
    ).rejects.toMatchObject({ name: "SearchConsoleNotConnectedError" });
  });

  it("denies Search Analytics when the property binding is revoked", async () => {
    findActivePropertyConnectionMock.mockResolvedValue({
      id: "connection-1",
      websiteId: WEBSITE_ID,
      observeOwnerId: "owner-1",
      googleIdentityId: "identity-1",
      propertyUri: "sc-domain:foundfy.me",
      propertyType: "domain",
      permissionLevel: "siteOwner",
      confirmationSource: "user",
      status: "revoked",
    });

    await expect(
      requireSearchConsoleConnection({
        websiteId: WEBSITE_ID,
        sessionToken: SESSION_TOKEN,
      }),
    ).rejects.toMatchObject({ name: "SearchConsoleNotConnectedError" });
  });

  it("disconnects for the owner and wipes the stored refresh token", async () => {
    await disconnectObserveOwner({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
    });

    expect(revokeObserveOwnerMock).toHaveBeenCalledWith("owner-1");
    expect(removeGoogleDerivedOwnerDataForWebsiteMock).toHaveBeenCalledWith(WEBSITE_ID);
    expect(deleteDecisionEngineForWebsiteMock).not.toHaveBeenCalled();
    expect(deleteSearchAnalyticsForWebsiteMock).not.toHaveBeenCalled();
    expect(revokeActivePropertyConnectionsForWebsiteMock).toHaveBeenCalledWith(WEBSITE_ID);
    expect(revokeOwnerSessionsForWebsiteIdentityMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
    });
    expect(revokeGoogleTokenMock).toHaveBeenCalledWith("refresh-token-plain");
    expect(disableGoogleOAuthTokenMock).toHaveBeenCalledWith("token-1");
  });

  it("denies disconnect for a non-owner session", async () => {
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-other",
      googleOAuthTokenId: "token-other",
      status: "google_connected",
    });

    await expect(
      disconnectObserveOwner({
        websiteId: WEBSITE_ID,
        sessionToken: SESSION_TOKEN,
      }),
    ).rejects.toBeInstanceOf(ObserveAuthError);

    expect(revokeObserveOwnerMock).not.toHaveBeenCalled();
    expect(disableGoogleOAuthTokenMock).not.toHaveBeenCalled();
  });

  it("still disables local token state if Google revocation fails", async () => {
    revokeGoogleTokenMock.mockRejectedValue(new Error("Google unavailable"));

    await expect(
      disconnectObserveOwner({
        websiteId: WEBSITE_ID,
        sessionToken: SESSION_TOKEN,
      }),
    ).resolves.toBeUndefined();

    expect(revokeObserveOwnerMock).toHaveBeenCalledWith("owner-1");
    expect(disableGoogleOAuthTokenMock).toHaveBeenCalledWith("token-1");
  });

  it("switches a pre-bind Google identity without destructive Google-derived cleanup", async () => {
    findActivePropertyConnectionMock.mockResolvedValue(null);
    startGoogleOAuthMock.mockResolvedValue({
      redirectUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=new",
    });

    const result = await switchPreBindGoogleAccount({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION_TOKEN,
      requestUrl: "http://localhost:3000/api/websites/id/observe/switch-account",
    });

    expect(removeGoogleDerivedOwnerDataForWebsiteMock).not.toHaveBeenCalled();
    expect(deleteDecisionEngineForWebsiteMock).not.toHaveBeenCalled();
    expect(deleteSearchAnalyticsForWebsiteMock).not.toHaveBeenCalled();
    expect(revokeActivePropertyConnectionsForWebsiteMock).not.toHaveBeenCalled();
    expect(revokeObserveOwnerMock).toHaveBeenCalledWith("owner-1");
    expect(disableGoogleOAuthTokenMock).toHaveBeenCalledWith("token-1");
    expect(startGoogleOAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({
        websiteId: WEBSITE_ID,
        purpose: "connect",
      }),
    );
    expect(result.redirectUrl).toContain("accounts.google.com");
  });

  it("does not allow pre-bind account switching after a property is bound", async () => {
    findActivePropertyConnectionMock.mockResolvedValue({
      id: "connection-1",
      websiteId: WEBSITE_ID,
      status: "connected",
      propertyUri: "sc-domain:foundfy.me",
    });

    await expect(
      switchPreBindGoogleAccount({
        websiteId: WEBSITE_ID,
        sessionToken: SESSION_TOKEN,
        requestUrl: "http://localhost:3000/switch",
      }),
    ).rejects.toMatchObject({ name: "ObserveOwnerConflictError" });
    expect(removeGoogleDerivedOwnerDataForWebsiteMock).not.toHaveBeenCalled();
    expect(startGoogleOAuthMock).not.toHaveBeenCalled();
  });

  it("does not revoke a shared identity token when another website still uses it", async () => {
    const websiteTwo = "7c2d0f3a-1b9e-4d55-9c8a-2e6f4b1a0d77";
    getWebsiteByIdMock.mockResolvedValue({
      id: websiteTwo,
      hostname: "gez.studio",
      displayUrl: "https://gez.studio/",
    });
    findOwnerSessionByTokenHashMock.mockResolvedValue({
      id: "session-2",
      googleIdentityId: "identity-1",
      websiteId: websiteTwo,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-2",
      websiteId: websiteTwo,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    findActivePropertyConnectionMock.mockResolvedValue(null);
    countActiveOwnersForIdentityMock.mockResolvedValue(1);
    startGoogleOAuthMock.mockResolvedValue({
      redirectUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=website-2",
    });

    await switchPreBindGoogleAccount({
      websiteId: websiteTwo,
      sessionToken: SESSION_TOKEN,
      requestUrl: "http://localhost:3000/api/websites/website-2/observe/switch-account",
    });

    expect(countActiveOwnersForIdentityMock).toHaveBeenCalledWith("identity-1");
    expect(revokeObserveOwnerMock).toHaveBeenCalledWith("owner-2");
    expect(revokeOwnerSessionsForWebsiteIdentityMock).toHaveBeenCalledWith({
      websiteId: websiteTwo,
      googleIdentityId: "identity-1",
    });
    expect(revokeGoogleTokenMock).not.toHaveBeenCalled();
    expect(disableGoogleOAuthTokenMock).not.toHaveBeenCalled();
    expect(removeGoogleDerivedOwnerDataForWebsiteMock).not.toHaveBeenCalled();
    expect(deleteDecisionEngineForWebsiteMock).not.toHaveBeenCalled();
    expect(deleteSearchAnalyticsForWebsiteMock).not.toHaveBeenCalled();
  });
});
