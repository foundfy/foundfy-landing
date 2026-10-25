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
  writeGoogleOAuthTokenIfUnchanged,
} from "./db";
import {
  exchangeGoogleAuthorizationCode,
  fetchGoogleUserInfo,
  revokeGoogleToken,
} from "./google";
import { resolveGoogleGrantReplacement } from "./oauth-grant";
import type { GoogleOAuthPurpose } from "./oauth-purpose";
import { oauthPurposeFromReturnPath } from "./oauth-purpose";
import { buildGoogleAuthorizationUrl, createOAuthStateValue } from "./oauth-url";
import {
  googleCapabilitiesFromScopes,
  persistableGrantedScopeString,
} from "./scopes";
import { OAuthStateError, type GoogleOAuthTokenRecord } from "./types";

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

    const newRefreshCiphertext = tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null;
    const storedToken = await persistGoogleGrantForIdentity({
      googleIdentityId: identity.id,
      returnedScopes: grantedScopes,
      newRefreshCiphertext,
    });
    if (!storedToken) {
      await safeRevoke(tokens.refreshToken);
      return { redirectUrl: siteObservePath(websiteId, "error") };
    }

    if (purpose === "setup") {
      const capabilities = googleCapabilitiesFromScopes(storedToken.scopes);
      if (!capabilities.canWriteSearchConsole || !capabilities.canVerifyNewOwnership) {
        const sessionToken = await createOwnerSession({
          googleIdentityId: identity.id,
          websiteId,
        });
        return { redirectUrl: siteObservePath(websiteId, "setup"), sessionToken };
      }
    }

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

const GOOGLE_GRANT_PERSIST_ATTEMPTS = 8;

export const oauthGrantPersistTestBridge = {
  beforeWrite: async (_existing: GoogleOAuthTokenRecord | null): Promise<void> => {},
};

async function persistGoogleGrantForIdentity(input: {
  googleIdentityId: string;
  returnedScopes: string;
  newRefreshCiphertext: string | null;
}): Promise<GoogleOAuthTokenRecord | null> {
  for (let attempt = 0; attempt < GOOGLE_GRANT_PERSIST_ATTEMPTS; attempt += 1) {
    const existingRow = await findGoogleOAuthTokenByIdentity(input.googleIdentityId);
    const usableExisting = isUsableStoredGrant(existingRow) ? existingRow : null;
    await oauthGrantPersistTestBridge.beforeWrite(usableExisting ?? existingRow);

    const resolvedGrant = resolveGoogleGrantReplacement({
      existingScopes: usableExisting?.scopes ?? null,
      existingRefreshCiphertext: usableExisting?.refreshTokenCiphertext ?? null,
      returnedScopes: input.returnedScopes,
      newRefreshCiphertext: input.newRefreshCiphertext,
    });
    if (!resolvedGrant) {
      return null;
    }

    const written = await writeGoogleOAuthTokenIfUnchanged({
      googleIdentityId: input.googleIdentityId,
      expectedScopes: existingRow?.scopes ?? null,
      expectedRefreshTokenCiphertext: existingRow?.refreshTokenCiphertext ?? null,
      encryptionKeyId: encryptionKeyIdFromCiphertext(resolvedGrant.refreshTokenCiphertext),
      refreshTokenCiphertext: resolvedGrant.refreshTokenCiphertext,
      scopes: resolvedGrant.scopes,
    });
    if (written.status === "written") {
      return written.token;
    }
  }

  throw new Error("Failed to store Google OAuth token: concurrent update.");
}

function isUsableStoredGrant(
  token: GoogleOAuthTokenRecord | null,
): token is GoogleOAuthTokenRecord {
  if (
    !token ||
    token.revokedAt ||
    token.refreshTokenCiphertext === "revoked"
  ) {
    return false;
  }

  try {
    decryptSecret(token.refreshTokenCiphertext);
    return true;
  } catch {
    return false;
  }
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
