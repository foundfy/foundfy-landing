import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAuthStateError } from "./types";

const getWebsiteByIdMock = vi.fn();
const insertOAuthStateMock = vi.fn();
const consumeOAuthStateMock = vi.fn();
const findActiveObserveOwnerMock = vi.fn();
const insertObserveOwnerMock = vi.fn();
const insertOwnerSessionMock = vi.fn();
const upsertGoogleIdentityMock = vi.fn();
const upsertGoogleOAuthTokenMock = vi.fn();
const exchangeGoogleAuthorizationCodeMock = vi.fn();
const fetchGoogleUserInfoMock = vi.fn();
const revokeGoogleTokenMock = vi.fn();

vi.mock("@/lib/websites/repository", () => ({
  getWebsiteById: (...args: unknown[]) => getWebsiteByIdMock(...args),
}));

vi.mock("./db", () => ({
  insertOAuthState: (...args: unknown[]) => insertOAuthStateMock(...args),
  consumeOAuthState: (...args: unknown[]) => consumeOAuthStateMock(...args),
  findActiveObserveOwner: (...args: unknown[]) => findActiveObserveOwnerMock(...args),
  insertObserveOwner: (...args: unknown[]) => insertObserveOwnerMock(...args),
  insertOwnerSession: (...args: unknown[]) => insertOwnerSessionMock(...args),
  upsertGoogleIdentity: (...args: unknown[]) => upsertGoogleIdentityMock(...args),
  upsertGoogleOAuthToken: (...args: unknown[]) => upsertGoogleOAuthTokenMock(...args),
}));

vi.mock("./google", () => ({
  exchangeGoogleAuthorizationCode: (...args: unknown[]) =>
    exchangeGoogleAuthorizationCodeMock(...args),
  fetchGoogleUserInfo: (...args: unknown[]) => fetchGoogleUserInfoMock(...args),
  revokeGoogleToken: (...args: unknown[]) => revokeGoogleTokenMock(...args),
}));

import { completeGoogleOAuth, startGoogleOAuth } from "./oauth";

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
    upsertGoogleOAuthTokenMock.mockImplementation(async (input: { refreshTokenCiphertext: string }) => ({
      id: "token-1",
      googleIdentityId: "identity-1",
      encryptionKeyId: "v1",
      refreshTokenCiphertext: input.refreshTokenCiphertext,
      scopes: "openid email https://www.googleapis.com/auth/webmasters.readonly",
      revokedAt: null,
    }));
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
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token-plain",
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
    const tokenInsert = upsertGoogleOAuthTokenMock.mock.calls[0]?.[0] as {
      refreshTokenCiphertext: string;
    };
    expect(tokenInsert.refreshTokenCiphertext).not.toContain("refresh-token-plain");
    expect(tokenInsert.refreshTokenCiphertext.startsWith("v1.")).toBe(true);
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

    expect(upsertGoogleOAuthTokenMock).not.toHaveBeenCalled();
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
    expect(upsertGoogleOAuthTokenMock).not.toHaveBeenCalled();
    expect(insertObserveOwnerMock).not.toHaveBeenCalled();
    expect(revokeGoogleTokenMock).toHaveBeenCalledWith("refresh-token-plain");
  });
});
