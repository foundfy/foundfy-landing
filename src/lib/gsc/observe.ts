import { getWebsiteById } from "@/lib/websites/repository";
import { hashSessionToken } from "./cookie";
import { decryptSecret } from "./crypto";
import {
  countActiveOwnersForIdentity,
  disableGoogleOAuthToken,
  findActiveObserveOwner,
  findGoogleIdentityById,
  findGoogleOAuthTokenById,
  findOwnerSessionByTokenHash,
  revokeObserveOwner,
  revokeOwnerSessionsForWebsiteIdentity,
} from "./db";
import { revokeGoogleToken } from "./google";
import { ObserveAuthError, type ObserveOwnerView } from "./types";

export async function resolveObserveOwnerView(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<ObserveOwnerView> {
  const website = await getWebsiteById(input.websiteId);
  if (!website) {
    throw new Error("Website not found.");
  }

  if (!input.sessionToken) {
    throw new ObserveAuthError(401, "Owner session required.");
  }

  const session = await findOwnerSessionByTokenHash(hashSessionToken(input.sessionToken));
  if (!session) {
    throw new ObserveAuthError(401, "Owner session required.");
  }

  const owner = await findActiveObserveOwner(input.websiteId);
  if (!owner || owner.googleIdentityId !== session.googleIdentityId) {
    throw new ObserveAuthError(403, "Not authorized.");
  }

  const identity = await findGoogleIdentityById(owner.googleIdentityId);

  return {
    status: "google_connected",
    email: identity?.email ?? null,
    propertySelected: false,
  };
}

export async function disconnectObserveOwner(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<void> {
  const website = await getWebsiteById(input.websiteId);
  if (!website) {
    throw new Error("Website not found.");
  }

  if (!input.sessionToken) {
    throw new ObserveAuthError(401, "Owner session required.");
  }

  const session = await findOwnerSessionByTokenHash(hashSessionToken(input.sessionToken));
  if (!session) {
    throw new ObserveAuthError(401, "Owner session required.");
  }

  const owner = await findActiveObserveOwner(input.websiteId);
  if (!owner || owner.googleIdentityId !== session.googleIdentityId) {
    throw new ObserveAuthError(403, "Not authorized.");
  }

  const token = await findGoogleOAuthTokenById(owner.googleOAuthTokenId);
  let refreshToken: string | null = null;
  if (token && token.revokedAt === null && token.refreshTokenCiphertext !== "revoked") {
    try {
      refreshToken = decryptSecret(token.refreshTokenCiphertext);
    } catch {
      refreshToken = null;
    }
  }

  await revokeObserveOwner(owner.id);
  await revokeOwnerSessionsForWebsiteIdentity({
    websiteId: input.websiteId,
    googleIdentityId: owner.googleIdentityId,
  });

  const remaining = await countActiveOwnersForIdentity(owner.googleIdentityId);
  if (remaining === 0 && token) {
    if (refreshToken) {
      try {
        await revokeGoogleToken(refreshToken);
      } catch {
        // Local disconnect still succeeds if Google revoke fails.
      }
    }

    await disableGoogleOAuthToken(token.id);
  }
}
