import { getWebsiteById } from "@/lib/websites/repository";
import {
  OAUTH_STATE_TTL_MS,
  OWNER_SESSION_TTL_MS,
  isGoogleOAuthConfigured,
  siteObservePath,
} from "./config";
import { createSessionToken, hashSessionToken } from "./cookie";
import { decryptSecret, encryptSecret, encryptionKeyIdFromCiphertext } from "./crypto";
import {
  consumeOAuthState,
  findActiveObserveOwner,
  findGoogleOAuthTokenByIdentity,
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
import type { GoogleOAuthPurpose } from "./oauth-purpose";
import { oauthPurposeFromReturnPath } from "./oauth-purpose";
import { buildGoogleAuthorizationUrl, createOAuthStateValue } from "./oauth-url";
import {
  googleCapabilitiesFromScopes,
  persistableGrantedScopeString,
} from "./scopes";
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
  purpose?: GoogleOAuthPurpose;
  sessionToken?: string | null;
}): Promise<{ redirectUrl: string }> {
  if (!isGoogleOAuthConfigured()) {
    throw new GoogleOAuthNotConfiguredError();
  }

  const website = await getWebsiteById(input.websiteId);
  if (!website) {
    throw new Error("Website not found.");
  }

  const purpose = input.purpose ?? "connect";
  if (purpose === "setup") {
    const { requireObserveOwner } = await import("./observe");
    await requireObserveOwner({
      websiteId: input.websiteId,
      sessionToken: input.sessionToken ?? null,
    });
  }

  const state = createOAuthStateValue();
  await insertOAuthState({
    state,
    websiteId: input.websiteId,
    returnPath: purpose === "setup" ? siteObservePath(input.websiteId, "setup") : siteObservePath(input.websiteId),
    expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString(),
  });

  return {
    redirectUrl: buildGoogleAuthorizationUrl({
      requestUrl: input.requestUrl,
      state,
      purpose,
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
    const purpose = oauthPurposeFromReturnPath(oauthState.returnPath);

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
    const grantedScopes = persistableGrantedScopeString(tokens.grantedScopes);

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
    if (purpose === "setup" && !existingOwner) {
      await safeRevoke(tokens.refreshToken);
      return { redirectUrl: siteObservePath(websiteId, "error") };
    }

    if (existingOwner && existingOwner.googleIdentityId !== identity.id) {
      await safeRevoke(tokens.refreshToken);
      return {
        redirectUrl: siteObservePath(
          websiteId,
          purpose === "setup" ? "setup_account_mismatch" : "already_connected",
        ),
      };
    }

    const refreshCiphertext = await resolveRefreshTokenCiphertext({
      purpose,
      googleIdentityId: identity.id,
      refreshToken: tokens.refreshToken,
    });
    if (!refreshCiphertext) {
      await safeRevoke(tokens.refreshToken);
      return { redirectUrl: siteObservePath(websiteId, "error") };
    }

    if (purpose === "setup") {
      const capabilities = googleCapabilitiesFromScopes(grantedScopes);
      if (!capabilities.canWriteSearchConsole || !capabilities.canVerifyNewOwnership) {
        await persistGrantedToken({
          googleIdentityId: identity.id,
          refreshCiphertext,
          grantedScopes,
        });
        const sessionToken = await createOwnerSession({
          googleIdentityId: identity.id,
          websiteId,
        });
        return { redirectUrl: siteObservePath(websiteId, "setup"), sessionToken };
      }
    }

    const storedToken = await persistGrantedToken({
      googleIdentityId: identity.id,
      refreshCiphertext,
      grantedScopes,
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

    const sessionToken = await createOwnerSession({
      googleIdentityId: identity.id,
      websiteId,
    });

    return {
      redirectUrl: siteObservePath(websiteId, purpose === "setup" ? "setup" : "connected"),
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

async function persistGrantedToken(input: {
  googleIdentityId: string;
  refreshCiphertext: string;
  grantedScopes: string;
}) {
  return upsertGoogleOAuthToken({
    googleIdentityId: input.googleIdentityId,
    encryptionKeyId: encryptionKeyIdFromCiphertext(input.refreshCiphertext),
    refreshTokenCiphertext: input.refreshCiphertext,
    scopes: input.grantedScopes,
  });
}

async function createOwnerSession(input: {
  googleIdentityId: string;
  websiteId: string;
}): Promise<string> {
  const sessionToken = createSessionToken();
  await insertOwnerSession({
    tokenHash: hashSessionToken(sessionToken),
    googleIdentityId: input.googleIdentityId,
    websiteId: input.websiteId,
    expiresAt: new Date(Date.now() + OWNER_SESSION_TTL_MS).toISOString(),
  });
  return sessionToken;
}

async function resolveRefreshTokenCiphertext(input: {
  purpose: GoogleOAuthPurpose;
  googleIdentityId: string;
  refreshToken: string | null;
}): Promise<string | null> {
  if (input.refreshToken) {
    return encryptSecret(input.refreshToken);
  }

  if (input.purpose !== "setup") {
    return null;
  }

  const existing = await findGoogleOAuthTokenByIdentity(input.googleIdentityId);
  if (
    !existing ||
    existing.revokedAt ||
    existing.refreshTokenCiphertext === "revoked" ||
    existing.googleIdentityId !== input.googleIdentityId
  ) {
    return null;
  }

  try {
    decryptSecret(existing.refreshTokenCiphertext);
  } catch {
    return null;
  }

  return existing.refreshTokenCiphertext;
}

async function safeRevoke(refreshToken: string | null): Promise<void> {
  if (!refreshToken) {
    return;
  }
  try {
    await revokeGoogleToken(refreshToken);
  } catch {
    // Ownership changes must not depend on Google being reachable.
  }
}
