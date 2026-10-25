import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAuthStateError } from "./types";

const getWebsiteByIdMock = vi.fn();
const insertOAuthStateMock = vi.fn();
const consumeOAuthStateMock = vi.fn();
const findActiveObserveOwnerMock = vi.fn();
const insertObserveOwnerMock = vi.fn();
const insertOwnerSessionMock = vi.fn();
const upsertGoogleIdentityMock = vi.fn();
const writeGoogleOAuthTokenIfUnchangedMock = vi.fn();
const exchangeGoogleAuthorizationCodeMock = vi.fn();
const fetchGoogleUserInfoMock = vi.fn();
const revokeGoogleTokenMock = vi.fn();

vi.mock("@/lib/websites/repository", () => ({
  getWebsiteById: (...args: unknown[]) => getWebsiteByIdMock(...args),
}));

const findGoogleOAuthTokenByIdentityMock = vi.fn();

vi.mock("./db", () => ({
  insertOAuthState: (...args: unknown[]) => insertOAuthStateMock(...args),
  consumeOAuthState: (...args: unknown[]) => consumeOAuthStateMock(...args),
  findActiveObserveOwner: (...args: unknown[]) => findActiveObserveOwnerMock(...args),
  insertObserveOwner: (...args: unknown[]) => insertObserveOwnerMock(...args),
  insertOwnerSession: (...args: unknown[]) => insertOwnerSessionMock(...args),
  upsertGoogleIdentity: (...args: unknown[]) => upsertGoogleIdentityMock(...args),
  writeGoogleOAuthTokenIfUnchanged: (...args: unknown[]) =>
    writeGoogleOAuthTokenIfUnchangedMock(...args),
  findGoogleOAuthTokenByIdentity: (...args: unknown[]) =>
    findGoogleOAuthTokenByIdentityMock(...args),
}));

vi.mock("./google", () => ({
  exchangeGoogleAuthorizationCode: (...args: unknown[]) =>
    exchangeGoogleAuthorizationCodeMock(...args),
  fetchGoogleUserInfo: (...args: unknown[]) => fetchGoogleUserInfoMock(...args),
  revokeGoogleToken: (...args: unknown[]) => revokeGoogleTokenMock(...args),
}));

const requireObserveOwnerMock = vi.fn();
vi.mock("./observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwnerMock(...args),
}));

import { encryptSecret } from "./crypto";
import {
  completeGoogleOAuth,
  oauthGrantPersistTestBridge,
  startGoogleOAuth,
} from "./oauth";
import { persistableGrantedScopeString } from "./scopes";
import type { GoogleOAuthTokenRecord } from "./types";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const ORIGINAL_ENV = { ...process.env };

function configureEnv() {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GSC_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  process.env.GSC_SESSION_SECRET = "session-secret";
}

describe("Google OAuth ownership flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    configureEnv();
    getWebsiteByIdMock.mockResolvedValue({
      id: WEBSITE_ID,
      hostname: "foundfy.me",
    });
    insertOAuthStateMock.mockResolvedValue(undefined);
    insertOwnerSessionMock.mockResolvedValue({
      id: "session-1",
      googleIdentityId: "identity-1",
      websiteId: WEBSITE_ID,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    upsertGoogleIdentityMock.mockResolvedValue({
      id: "identity-1",
      googleSub: "google-sub-1",
      email: "jose@foundfy.me",
    });
    oauthGrantPersistTestBridge.beforeWrite = async () => {};
    writeGoogleOAuthTokenIfUnchangedMock.mockImplementation(
      async (input: { refreshTokenCiphertext: string; scopes: string }) => ({
        status: "written",
        token: {
          id: "token-1",
          googleIdentityId: "identity-1",
          encryptionKeyId: "v1",
          refreshTokenCiphertext: input.refreshTokenCiphertext,
          scopes: input.scopes,
          revokedAt: null,
        },
      }),
    );
    findActiveObserveOwnerMock.mockResolvedValue(null);
    insertObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    consumeOAuthStateMock.mockResolvedValue({
      id: "state-1",
      state: "state-value",
      websiteId: WEBSITE_ID,
      returnPath: `/site/${WEBSITE_ID}`,
      expiresAt: "2099-01-01T00:00:00.000Z",
      consumedAt: "2026-09-20T00:00:00.000Z",
    });
    findGoogleOAuthTokenByIdentityMock.mockResolvedValue(null);
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token-plain",
      grantedScopes: "openid email https://www.googleapis.com/auth/webmasters.readonly",
    });
    fetchGoogleUserInfoMock.mockResolvedValue({
      sub: "google-sub-1",
      email: "jose@foundfy.me",
    });
    revokeGoogleTokenMock.mockResolvedValue(undefined);
  });

  it("binds OAuth start state to the website and redirects to Google", async () => {
    const started = await startGoogleOAuth({
      websiteId: WEBSITE_ID,
      requestUrl: "http://localhost:3000/api/websites/id/observe/connect",
    });

    expect(getWebsiteByIdMock).toHaveBeenCalledWith(WEBSITE_ID);
    expect(insertOAuthStateMock).toHaveBeenCalledTimes(1);
    const stored = insertOAuthStateMock.mock.calls[0]?.[0] as {
      websiteId: string;
      state: string;
      expiresAt: string;
    };
    expect(stored.websiteId).toBe(WEBSITE_ID);
    expect(stored.state).toMatch(/^[A-Za-z0-9_-]+$/);
    const expiresInMs = new Date(stored.expiresAt).getTime() - Date.now();
    expect(expiresInMs).toBeGreaterThan(8 * 60 * 1000);
    expect(expiresInMs).toBeLessThan(11 * 60 * 1000);
    expect(started.redirectUrl).toContain("accounts.google.com");
    expect(started.redirectUrl).toContain(`state=${stored.state}`);
    expect(started.redirectUrl).not.toContain("test-client-secret");
    const connectScopes = new URL(started.redirectUrl).searchParams.get("scope")?.split(" ") ?? [];
    expect(connectScopes).toContain("https://www.googleapis.com/auth/webmasters.readonly");
    expect(connectScopes).not.toContain("https://www.googleapis.com/auth/webmasters");
    expect(connectScopes.join(" ")).not.toContain("siteverification");
    expect(new URL(started.redirectUrl).searchParams.get("include_granted_scopes")).toBe(
      "true",
    );
    expect(insertOAuthStateMock.mock.calls[0]?.[0]).toMatchObject({
      returnPath: `/site/${WEBSITE_ID}`,
    });
  });

  it("rejects start when the website does not exist", async () => {
    getWebsiteByIdMock.mockResolvedValue(null);
    await expect(
      startGoogleOAuth({
        websiteId: WEBSITE_ID,
        requestUrl: "http://localhost:3000/connect",
      }),
    ).rejects.toThrow("Website not found.");
    expect(insertOAuthStateMock).not.toHaveBeenCalled();
  });

  it("creates an owner session after a successful callback and encrypts the refresh token", async () => {
    const result = await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "auth-code",
      state: "state-value",
      oauthError: null,
    });

    expect(result.redirectUrl).toBe(`/site/${WEBSITE_ID}?observe=connected`);
    expect(result.sessionToken).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("refresh-token-plain");
    expect(upsertGoogleIdentityMock).toHaveBeenCalledWith({
      googleSub: "google-sub-1",
      email: "jose@foundfy.me",
    });
    const tokenInsert = writeGoogleOAuthTokenIfUnchangedMock.mock.calls[0]?.[0] as {
      refreshTokenCiphertext: string;
      scopes: string;
    };
    expect(tokenInsert.refreshTokenCiphertext).not.toContain("refresh-token-plain");
    expect(tokenInsert.refreshTokenCiphertext.startsWith("v1.")).toBe(true);
    expect(tokenInsert.scopes).toBe(
      "email https://www.googleapis.com/auth/webmasters.readonly openid",
    );
    expect(insertObserveOwnerMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
    });
    expect(insertOwnerSessionMock).toHaveBeenCalled();
  });

  it("treats OAuth denial as a cancelled connection, not an owner bind", async () => {
    const result = await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: null,
      state: "state-value",
      oauthError: "access_denied",
    });

    expect(result.redirectUrl).toBe(`/site/${WEBSITE_ID}?observe=denied`);
    expect(result.sessionToken).toBeUndefined();
    expect(exchangeGoogleAuthorizationCodeMock).not.toHaveBeenCalled();
    expect(insertObserveOwnerMock).not.toHaveBeenCalled();
  });

  it("rejects missing, expired, and reused OAuth state", async () => {
    consumeOAuthStateMock.mockRejectedValueOnce(new OAuthStateError("missing"));
    await expect(
      completeGoogleOAuth({
        requestUrl: "http://localhost:3000/callback",
        code: "code",
        state: null,
        oauthError: null,
      }),
    ).resolves.toMatchObject({ redirectUrl: "/?observe=error" });

    consumeOAuthStateMock.mockRejectedValueOnce(new OAuthStateError("expired"));
    await expect(
      completeGoogleOAuth({
        requestUrl: "http://localhost:3000/callback",
        code: "code",
        state: "stale",
        oauthError: null,
      }),
    ).resolves.toMatchObject({ redirectUrl: "/?observe=error" });

    consumeOAuthStateMock.mockRejectedValueOnce(new OAuthStateError("reused"));
    await expect(
      completeGoogleOAuth({
        requestUrl: "http://localhost:3000/callback",
        code: "code",
        state: "used",
        oauthError: null,
      }),
    ).resolves.toMatchObject({ redirectUrl: "/?observe=error" });

    expect(writeGoogleOAuthTokenIfUnchangedMock).not.toHaveBeenCalled();
  });

  it("does not let a second Google identity replace an existing observe owner", async () => {
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-original",
      googleOAuthTokenId: "token-original",
      status: "google_connected",
    });
    upsertGoogleIdentityMock.mockResolvedValue({
      id: "identity-attacker",
      googleSub: "google-sub-attacker",
      email: "attacker@example.com",
    });

    const result = await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "auth-code",
      state: "state-value",
      oauthError: null,
    });

    expect(result.redirectUrl).toBe(`/site/${WEBSITE_ID}?observe=already_connected`);
    expect(result.sessionToken).toBeUndefined();
    expect(writeGoogleOAuthTokenIfUnchangedMock).not.toHaveBeenCalled();
    expect(insertObserveOwnerMock).not.toHaveBeenCalled();
    expect(revokeGoogleTokenMock).toHaveBeenCalledWith("refresh-token-plain");
  });

  it("requests setup scopes only for incremental Search Console setup", async () => {
    requireObserveOwnerMock.mockResolvedValue({
      website: { id: WEBSITE_ID, hostname: "foundfy.me" },
      owner: { googleIdentityId: "identity-1" },
    });

    const started = await startGoogleOAuth({
      websiteId: WEBSITE_ID,
      requestUrl: "http://localhost:3000/api/websites/id/observe/setup/connect",
      purpose: "setup",
      sessionToken: "owner-session",
    });

    const stored = insertOAuthStateMock.mock.calls[0]?.[0] as { returnPath: string };
    expect(stored.returnPath).toBe(`/site/${WEBSITE_ID}?observe=setup`);
    expect(started.redirectUrl).toContain(encodeURIComponent("auth/webmasters"));
    expect(started.redirectUrl).toContain(
      encodeURIComponent("siteverification.verify_only"),
    );
    expect(started.redirectUrl).not.toContain(
      encodeURIComponent("auth/siteverification "),
    );
    expect(started.redirectUrl).toContain("include_granted_scopes=true");
    expect(new URL(started.redirectUrl).searchParams.get("scope")).not.toBe(
      "https://www.googleapis.com/auth/siteverification",
    );
    expect(new URL(started.redirectUrl).searchParams.get("scope")?.split(" ")).not.toContain(
      "https://www.googleapis.com/auth/siteverification",
    );
  });

  it("keeps ordinary reconnect readonly while enabling include_granted_scopes", async () => {
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    requireObserveOwnerMock.mockResolvedValue({
      website: { id: WEBSITE_ID, hostname: "foundfy.me" },
      owner: { googleIdentityId: "identity-1" },
    });

    const started = await startGoogleOAuth({
      websiteId: WEBSITE_ID,
      requestUrl: "http://localhost:3000/api/websites/id/observe/connect",
    });

    const url = new URL(started.redirectUrl);
    const scopes = url.searchParams.get("scope")?.split(" ") ?? [];
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
    expect(scopes).toContain("https://www.googleapis.com/auth/webmasters.readonly");
    expect(scopes).not.toContain("https://www.googleapis.com/auth/webmasters");
    expect(scopes.join(" ")).not.toContain("siteverification");
  });

  it("persists Google-granted setup scopes instead of the requested constant", async () => {
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    consumeOAuthStateMock.mockResolvedValue({
      id: "state-1",
      state: "state-value",
      websiteId: WEBSITE_ID,
      returnPath: `/site/${WEBSITE_ID}?observe=setup`,
      expiresAt: "2099-01-01T00:00:00.000Z",
      consumedAt: "2026-09-20T00:00:00.000Z",
    });
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "setup-refresh",
      grantedScopes:
        "openid email https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/siteverification.verify_only",
    });

    const result = await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "auth-code",
      state: "state-value",
      oauthError: null,
    });

    expect(result.redirectUrl).toBe(`/site/${WEBSITE_ID}?observe=setup`);
    const tokenInsert = writeGoogleOAuthTokenIfUnchangedMock.mock.calls[0]?.[0] as { scopes: string };
    expect(tokenInsert.scopes).toContain("https://www.googleapis.com/auth/webmasters");
    expect(tokenInsert.scopes).toContain(
      "https://www.googleapis.com/auth/siteverification.verify_only",
    );
    expect(tokenInsert.scopes).not.toBe(
      "openid email https://www.googleapis.com/auth/webmasters.readonly",
    );
  });

  it("keeps the same-identity refresh token when incremental auth omits a new one", async () => {
    const existingCipher = encryptSecret("existing-refresh");
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    findGoogleOAuthTokenByIdentityMock.mockResolvedValue({
      id: "token-1",
      googleIdentityId: "identity-1",
      encryptionKeyId: "v1",
      refreshTokenCiphertext: existingCipher,
      scopes: "email openid https://www.googleapis.com/auth/webmasters.readonly",
      revokedAt: null,
    });
    consumeOAuthStateMock.mockResolvedValue({
      id: "state-1",
      state: "state-value",
      websiteId: WEBSITE_ID,
      returnPath: `/site/${WEBSITE_ID}?observe=setup`,
      expiresAt: "2099-01-01T00:00:00.000Z",
      consumedAt: "2026-09-20T00:00:00.000Z",
    });
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: null,
      grantedScopes:
        "https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/siteverification.verify_only",
    });

    await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "auth-code",
      state: "state-value",
      oauthError: null,
    });

    const tokenInsert = writeGoogleOAuthTokenIfUnchangedMock.mock.calls[0]?.[0] as {
      refreshTokenCiphertext: string;
      scopes: string;
    };
    expect(tokenInsert.refreshTokenCiphertext).toBe(existingCipher);
    expect(tokenInsert.scopes).toContain("https://www.googleapis.com/auth/webmasters");
    expect(tokenInsert.scopes).toContain(
      "https://www.googleapis.com/auth/siteverification.verify_only",
    );
  });

  it("does not let ordinary reconnect replace a wider setup grant with readonly scopes", async () => {
    const existingCipher = encryptSecret("existing-setup-refresh");
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    findGoogleOAuthTokenByIdentityMock.mockResolvedValue({
      id: "token-1",
      googleIdentityId: "identity-1",
      encryptionKeyId: "v1",
      refreshTokenCiphertext: existingCipher,
      scopes:
        "email https://www.googleapis.com/auth/siteverification.verify_only https://www.googleapis.com/auth/webmasters openid",
      revokedAt: null,
    });
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "narrow-readonly-refresh",
      grantedScopes: "openid email https://www.googleapis.com/auth/webmasters.readonly",
    });

    const result = await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "auth-code",
      state: "state-value",
      oauthError: null,
    });

    expect(result.redirectUrl).toBe(`/site/${WEBSITE_ID}?observe=connected`);
    const tokenInsert = writeGoogleOAuthTokenIfUnchangedMock.mock.calls[0]?.[0] as {
      refreshTokenCiphertext: string;
      scopes: string;
    };
    expect(tokenInsert.refreshTokenCiphertext).toBe(existingCipher);
    expect(JSON.stringify(tokenInsert)).not.toContain("narrow-readonly-refresh");
    expect(tokenInsert.scopes).toContain("https://www.googleapis.com/auth/webmasters");
    expect(tokenInsert.scopes).toContain(
      "https://www.googleapis.com/auth/siteverification.verify_only",
    );
    expect(tokenInsert.scopes.split(" ")).not.toContain(
      "https://www.googleapis.com/auth/webmasters.readonly",
    );
  });

  it("keeps a wider grant when ordinary reconnect omits a refresh token and returns readonly scopes", async () => {
    const existingCipher = encryptSecret("existing-setup-refresh");
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    findGoogleOAuthTokenByIdentityMock.mockResolvedValue({
      id: "token-1",
      googleIdentityId: "identity-1",
      encryptionKeyId: "v1",
      refreshTokenCiphertext: existingCipher,
      scopes:
        "email https://www.googleapis.com/auth/siteverification.verify_only https://www.googleapis.com/auth/webmasters openid",
      revokedAt: null,
    });
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: null,
      grantedScopes: "openid email https://www.googleapis.com/auth/webmasters.readonly",
    });

    const result = await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "auth-code",
      state: "state-value",
      oauthError: null,
    });

    expect(result.redirectUrl).toBe(`/site/${WEBSITE_ID}?observe=connected`);
    const tokenInsert = writeGoogleOAuthTokenIfUnchangedMock.mock.calls[0]?.[0] as {
      refreshTokenCiphertext: string;
      scopes: string;
    };
    expect(tokenInsert.refreshTokenCiphertext).toBe(existingCipher);
    expect(tokenInsert.scopes).toContain(
      "https://www.googleapis.com/auth/siteverification.verify_only",
    );
  });

  it("replaces the refresh token when ordinary reconnect returns combined scopes and a new refresh token", async () => {
    const existingCipher = encryptSecret("existing-setup-refresh");
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    findGoogleOAuthTokenByIdentityMock.mockResolvedValue({
      id: "token-1",
      googleIdentityId: "identity-1",
      encryptionKeyId: "v1",
      refreshTokenCiphertext: existingCipher,
      scopes:
        "email https://www.googleapis.com/auth/siteverification.verify_only https://www.googleapis.com/auth/webmasters openid",
      revokedAt: null,
    });
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "combined-refresh",
      grantedScopes:
        "openid email https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/siteverification.verify_only",
    });

    await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "auth-code",
      state: "state-value",
      oauthError: null,
    });

    const tokenInsert = writeGoogleOAuthTokenIfUnchangedMock.mock.calls[0]?.[0] as {
      refreshTokenCiphertext: string;
      scopes: string;
    };
    expect(tokenInsert.refreshTokenCiphertext).not.toBe(existingCipher);
    expect(tokenInsert.refreshTokenCiphertext.startsWith("v1.")).toBe(true);
    expect(tokenInsert.scopes).toContain("https://www.googleapis.com/auth/webmasters");
    expect(tokenInsert.scopes).toContain(
      "https://www.googleapis.com/auth/siteverification.verify_only",
    );
  });

  it("does not keep false-positive setup capabilities after partial setup consent", async () => {
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    consumeOAuthStateMock.mockResolvedValue({
      id: "state-1",
      state: "state-value",
      websiteId: WEBSITE_ID,
      returnPath: `/site/${WEBSITE_ID}?observe=setup`,
      expiresAt: "2099-01-01T00:00:00.000Z",
      consumedAt: "2026-09-20T00:00:00.000Z",
    });
    findGoogleOAuthTokenByIdentityMock.mockResolvedValue({
      id: "token-1",
      googleIdentityId: "identity-1",
      encryptionKeyId: "v1",
      refreshTokenCiphertext: encryptSecret("readonly-refresh"),
      scopes: "email openid https://www.googleapis.com/auth/webmasters.readonly",
      revokedAt: null,
    });
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "partial-setup-refresh",
      grantedScopes: "https://www.googleapis.com/auth/webmasters",
    });

    const result = await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "auth-code",
      state: "state-value",
      oauthError: null,
    });

    expect(result.redirectUrl).toBe(`/site/${WEBSITE_ID}?observe=setup`);
    const tokenInsert = writeGoogleOAuthTokenIfUnchangedMock.mock.calls[0]?.[0] as { scopes: string };
    expect(tokenInsert.scopes).toBe("https://www.googleapis.com/auth/webmasters");
    expect(tokenInsert.scopes).not.toContain("siteverification");
  });

  it("persists a replacement grant when the stored refresh credential is no longer usable", async () => {
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    findGoogleOAuthTokenByIdentityMock.mockResolvedValue({
      id: "token-1",
      googleIdentityId: "identity-1",
      encryptionKeyId: "v1",
      refreshTokenCiphertext: "revoked",
      scopes:
        "email https://www.googleapis.com/auth/siteverification.verify_only https://www.googleapis.com/auth/webmasters openid",
      revokedAt: "2026-10-23T21:00:00.000Z",
    });
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "replacement-refresh",
      grantedScopes: "openid email https://www.googleapis.com/auth/webmasters.readonly",
    });

    const result = await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "auth-code",
      state: "state-value",
      oauthError: null,
    });

    expect(result.redirectUrl).toBe(`/site/${WEBSITE_ID}?observe=connected`);
    const tokenInsert = writeGoogleOAuthTokenIfUnchangedMock.mock.calls[0]?.[0] as {
      refreshTokenCiphertext: string;
      scopes: string;
    };
    expect(tokenInsert.refreshTokenCiphertext).not.toBe("revoked");
    expect(tokenInsert.scopes).toBe(
      "email https://www.googleapis.com/auth/webmasters.readonly openid",
    );
    expect(tokenInsert.scopes).not.toContain("siteverification");
  });

  it("does not let another website's ordinary connect downgrade a shared identity grant", async () => {
    const existingCipher = encryptSecret("shared-setup-refresh");
    findActiveObserveOwnerMock.mockResolvedValue(null);
    findGoogleOAuthTokenByIdentityMock.mockResolvedValue({
      id: "token-1",
      googleIdentityId: "identity-1",
      encryptionKeyId: "v1",
      refreshTokenCiphertext: existingCipher,
      scopes:
        "email https://www.googleapis.com/auth/siteverification.verify_only https://www.googleapis.com/auth/webmasters openid",
      revokedAt: null,
    });
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "website-b-readonly-refresh",
      grantedScopes: "openid email https://www.googleapis.com/auth/webmasters.readonly",
    });

    const result = await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "auth-code",
      state: "state-value",
      oauthError: null,
    });

    expect(result.redirectUrl).toBe(`/site/${WEBSITE_ID}?observe=connected`);
    expect(insertObserveOwnerMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
    });
    const tokenInsert = writeGoogleOAuthTokenIfUnchangedMock.mock.calls[0]?.[0] as {
      refreshTokenCiphertext: string;
      scopes: string;
    };
    expect(tokenInsert.refreshTokenCiphertext).toBe(existingCipher);
    expect(JSON.stringify(tokenInsert)).not.toContain("website-b-readonly-refresh");
    expect(tokenInsert.scopes).toContain(
      "https://www.googleapis.com/auth/siteverification.verify_only",
    );
  });

  it("does not reuse a refresh token across Google identities", async () => {
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    upsertGoogleIdentityMock.mockResolvedValue({
      id: "identity-other",
      googleSub: "google-sub-other",
      email: "other@example.com",
    });
    consumeOAuthStateMock.mockResolvedValue({
      id: "state-1",
      state: "state-value",
      websiteId: WEBSITE_ID,
      returnPath: `/site/${WEBSITE_ID}?observe=setup`,
      expiresAt: "2099-01-01T00:00:00.000Z",
      consumedAt: "2026-09-20T00:00:00.000Z",
    });
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "other-refresh",
      grantedScopes: "https://www.googleapis.com/auth/webmasters",
    });

    const result = await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "auth-code",
      state: "state-value",
      oauthError: null,
    });

    expect(result.redirectUrl).toBe(`/site/${WEBSITE_ID}?observe=setup_account_mismatch`);
    expect(writeGoogleOAuthTokenIfUnchangedMock).not.toHaveBeenCalled();
    expect(findGoogleOAuthTokenByIdentityMock).not.toHaveBeenCalled();
  });

  it("fails closed when incremental setup omits a refresh token and none is stored", async () => {
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    findGoogleOAuthTokenByIdentityMock.mockResolvedValue(null);
    consumeOAuthStateMock.mockResolvedValue({
      id: "state-1",
      state: "state-value",
      websiteId: WEBSITE_ID,
      returnPath: `/site/${WEBSITE_ID}?observe=setup`,
      expiresAt: "2099-01-01T00:00:00.000Z",
      consumedAt: "2026-09-20T00:00:00.000Z",
    });
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: null,
      grantedScopes:
        "https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/siteverification.verify_only",
    });

    const result = await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "auth-code",
      state: "state-value",
      oauthError: null,
    });

    expect(result.redirectUrl).toBe(`/site/${WEBSITE_ID}?observe=error`);
    expect(writeGoogleOAuthTokenIfUnchangedMock).not.toHaveBeenCalled();
  });

  it("does not treat partial setup scopes as authorized setup", async () => {
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    consumeOAuthStateMock.mockResolvedValue({
      id: "state-1",
      state: "state-value",
      websiteId: WEBSITE_ID,
      returnPath: `/site/${WEBSITE_ID}?observe=setup`,
      expiresAt: "2099-01-01T00:00:00.000Z",
      consumedAt: "2026-09-20T00:00:00.000Z",
    });
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "setup-refresh",
      grantedScopes: "https://www.googleapis.com/auth/webmasters",
    });

    await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "auth-code",
      state: "state-value",
      oauthError: null,
    });

    const tokenInsert = writeGoogleOAuthTokenIfUnchangedMock.mock.calls[0]?.[0] as { scopes: string };
    expect(tokenInsert.scopes).toBe("https://www.googleapis.com/auth/webmasters");
    expect(tokenInsert.scopes).not.toContain("siteverification");
  });

  it("binds setup callback state to the originating website only", async () => {
    consumeOAuthStateMock.mockResolvedValue({
      id: "state-1",
      state: "state-value",
      websiteId: WEBSITE_ID,
      returnPath: `/site/${WEBSITE_ID}?observe=setup`,
      expiresAt: "2099-01-01T00:00:00.000Z",
      consumedAt: "2026-09-20T00:00:00.000Z",
    });
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "setup-refresh",
      grantedScopes:
        "https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/siteverification.verify_only",
    });

    const result = await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "auth-code",
      state: "state-value",
      oauthError: null,
    });

    expect(result.redirectUrl).toContain(WEBSITE_ID);
    expect(result.redirectUrl).not.toContain("other-website");
  });

  it("does not let an interleaved ordinary callback overwrite a concurrent wider grant", async () => {
    const readonlyScopes = persistableGrantedScopeString(
      "openid email https://www.googleapis.com/auth/webmasters.readonly",
    );
    const setupScopes = persistableGrantedScopeString(
      "openid email https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/siteverification.verify_only",
    );
    const existingCipher = encryptSecret("readonly-refresh");
    let stored: GoogleOAuthTokenRecord = {
      id: "token-1",
      googleIdentityId: "identity-1",
      encryptionKeyId: "v1",
      refreshTokenCiphertext: existingCipher,
      scopes: readonlyScopes,
      revokedAt: null,
    };

    findGoogleOAuthTokenByIdentityMock.mockImplementation(async () => stored);
    findActiveObserveOwnerMock.mockResolvedValue({
      id: "owner-1",
      websiteId: WEBSITE_ID,
      googleIdentityId: "identity-1",
      googleOAuthTokenId: "token-1",
      status: "google_connected",
    });
    writeGoogleOAuthTokenIfUnchangedMock.mockImplementation(
      async (input: {
        expectedScopes: string | null;
        expectedRefreshTokenCiphertext: string | null;
        refreshTokenCiphertext: string;
        scopes: string;
      }) => {
        if (input.expectedRefreshTokenCiphertext === null) {
          return { status: "conflict" as const };
        }
        if (
          stored.refreshTokenCiphertext !== input.expectedRefreshTokenCiphertext ||
          stored.scopes !== input.expectedScopes
        ) {
          return { status: "conflict" as const };
        }
        stored = {
          ...stored,
          refreshTokenCiphertext: input.refreshTokenCiphertext,
          scopes: input.scopes,
          revokedAt: null,
        };
        return { status: "written" as const, token: stored };
      },
    );

    let interleaved = false;
    oauthGrantPersistTestBridge.beforeWrite = async () => {
      if (interleaved) {
        return;
      }
      interleaved = true;
      consumeOAuthStateMock.mockResolvedValueOnce({
        id: "state-setup",
        state: "state-setup",
        websiteId: WEBSITE_ID,
        returnPath: `/site/${WEBSITE_ID}?observe=setup`,
        expiresAt: "2099-01-01T00:00:00.000Z",
        consumedAt: "2026-09-20T00:00:00.000Z",
      });
      exchangeGoogleAuthorizationCodeMock.mockResolvedValueOnce({
        accessToken: "setup-access",
        refreshToken: "setup-refresh",
        grantedScopes:
          "openid email https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/siteverification.verify_only",
      });
      await completeGoogleOAuth({
        requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
        code: "setup-code",
        state: "state-setup",
        oauthError: null,
      });
    };

    consumeOAuthStateMock.mockResolvedValue({
      id: "state-connect",
      state: "state-connect",
      websiteId: WEBSITE_ID,
      returnPath: `/site/${WEBSITE_ID}`,
      expiresAt: "2099-01-01T00:00:00.000Z",
      consumedAt: "2026-09-20T00:00:00.000Z",
    });
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "readonly-access",
      refreshToken: "narrow-readonly-refresh",
      grantedScopes: "openid email https://www.googleapis.com/auth/webmasters.readonly",
    });

    await completeGoogleOAuth({
      requestUrl: "http://localhost:3000/api/gsc/oauth/callback",
      code: "connect-code",
      state: "state-connect",
      oauthError: null,
    });

    expect(stored.scopes).toBe(setupScopes);
    expect(stored.refreshTokenCiphertext).not.toBe(existingCipher);
    expect(JSON.stringify(stored)).not.toContain("narrow-readonly-refresh");
    expect(stored.scopes).toContain("https://www.googleapis.com/auth/webmasters");
    expect(stored.scopes).toContain(
      "https://www.googleapis.com/auth/siteverification.verify_only",
    );
  });
});
