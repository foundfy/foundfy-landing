import { getWebsiteById } from "@/lib/websites/repository";
import {
  GOOGLE_OAUTH_SCOPE_STRING,
  OAUTH_STATE_TTL_MS,
  OWNER_SESSION_TTL_MS,
  isGoogleOAuthConfigured,
  siteObservePath,
} from "./config";
import { createSessionToken, hashSessionToken } from "./cookie";
import { encryptSecret, encryptionKeyIdFromCiphertext } from "./crypto";
import {
  consumeOAuthState,
  findActiveObserveOwner,
  insertObserveOwner,
  insertOAuthState,
  insertOwnerSession,
  upsertGoogleIdentity,
  upsertGoogleOAuthToken,
} from "./db";
import {
  exchangeGoogleAuthorizationCode,
  fetchGoogleUserInfo,
  revokeGoogleToken,
} from "./google";
import { buildGoogleAuthorizationUrl, createOAuthStateValue } from "./oauth-url";
import { OAuthStateError } from "./types";

export class GoogleOAuthNotConfiguredError extends Error {
  constructor() {
    super("Google Search connection is not configured yet.");
    this.name = "GoogleOAuthNotConfiguredError";
  }
}

export async function startGoogleOAuth(input: {
  websiteId: string;
  requestUrl: string;
}): Promise<{ redirectUrl: string }> {
  if (!isGoogleOAuthConfigured()) {
    throw new GoogleOAuthNotConfiguredError();
  }

  const website = await getWebsiteById(input.websiteId);
  if (!website) {
    throw new Error("Website not found.");
  }

  const state = createOAuthStateValue();
  await insertOAuthState({
    state,
    websiteId: input.websiteId,
    returnPath: siteObservePath(input.websiteId),
    expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString(),
  });

  return {
    redirectUrl: buildGoogleAuthorizationUrl({
      requestUrl: input.requestUrl,
      state,
    }),
  };
}

export async function completeGoogleOAuth(input: {
  requestUrl: string;
  code: string | null;
  state: string | null;
  oauthError: string | null;
}): Promise<{ redirectUrl: string; sessionToken?: string }> {
  let websiteId: string | null = null;

  try {
    const oauthState = await consumeOAuthState(input.state ?? "");
    websiteId = oauthState.websiteId;

    if (input.oauthError === "access_denied") {
      return { redirectUrl: siteObservePath(websiteId, "denied") };
    }

    if (input.oauthError || !input.code) {
      return { redirectUrl: siteObservePath(websiteId, "error") };
    }

    const tokens = await exchangeGoogleAuthorizationCode({
      code: input.code,
      requestUrl: input.requestUrl,
    });

    let userInfo;
    try {
      userInfo = await fetchGoogleUserInfo(tokens.accessToken);
    } catch (error) {
      await safeRevoke(tokens.refreshToken);
      throw error;
    }

    const identity = await upsertGoogleIdentity({
      googleSub: userInfo.sub,
      email: userInfo.email,
    });

    const existingOwner = await findActiveObserveOwner(websiteId);
    if (existingOwner && existingOwner.googleIdentityId !== identity.id) {
      await safeRevoke(tokens.refreshToken);
      return { redirectUrl: siteObservePath(websiteId, "already_connected") };
    }

    const ciphertext = encryptSecret(tokens.refreshToken);
    const storedToken = await upsertGoogleOAuthToken({
      googleIdentityId: identity.id,
      encryptionKeyId: encryptionKeyIdFromCiphertext(ciphertext),
      refreshTokenCiphertext: ciphertext,
      scopes: GOOGLE_OAUTH_SCOPE_STRING,
    });

    if (!existingOwner) {
      const reserved = await insertObserveOwner({
        websiteId,
        googleIdentityId: identity.id,
        googleOAuthTokenId: storedToken.id,
      });

      if (reserved.googleIdentityId !== identity.id) {
        await safeRevoke(tokens.refreshToken);
        return { redirectUrl: siteObservePath(websiteId, "already_connected") };
      }
    }

    const sessionToken = createSessionToken();
    await insertOwnerSession({
      tokenHash: hashSessionToken(sessionToken),
      googleIdentityId: identity.id,
      websiteId,
      expiresAt: new Date(Date.now() + OWNER_SESSION_TTL_MS).toISOString(),
    });

    return {
      redirectUrl: siteObservePath(websiteId, "connected"),
      sessionToken,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OAuth error";
    console.error("[Observe] Google OAuth callback failed:", message);

    if (error instanceof OAuthStateError) {
      return { redirectUrl: "/?observe=error" };
    }

    if (websiteId) {
      return { redirectUrl: siteObservePath(websiteId, "error") };
    }

    return { redirectUrl: "/?observe=error" };
  }
}

async function safeRevoke(refreshToken: string): Promise<void> {
  try {
    await revokeGoogleToken(refreshToken);
  } catch {
    // Ownership changes must not depend on Google being reachable.
  }
}
