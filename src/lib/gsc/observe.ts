import { getWebsiteById } from "@/lib/websites/repository";
import type { WebsiteRecord } from "@/lib/websites/types";
import { hashSessionToken } from "./cookie";
import { decryptSecret } from "./crypto";
import {
  countActiveOwnersForIdentity,
  disableGoogleOAuthToken,
  findActiveObserveOwner,
  findActivePropertyConnection,
  findGoogleIdentityById,
  findGoogleOAuthTokenById,
  findOwnerSessionByTokenHash,
  revokeActivePropertyConnectionsForWebsite,
  revokeObserveOwner,
  revokeOwnerSessionsForWebsiteIdentity,
} from "./db";
import { deleteSearchAnalyticsForWebsite } from "./db-search";
import { revokeGoogleToken } from "./google";
import {
  ObserveAuthError,
  SearchConsoleNotConnectedError,
  type GoogleIdentityRecord,
  type GoogleOAuthTokenRecord,
  type GscPropertyConnectionRecord,
  type ObserveOwnerRecord,
  type ObserveOwnerView,
  type OwnerSessionRecord,
} from "./types";

export type ObserveOwnerContext = {
  website: WebsiteRecord;
  session: OwnerSessionRecord;
  owner: ObserveOwnerRecord;
  identity: GoogleIdentityRecord | null;
  token: GoogleOAuthTokenRecord | null;
};

export type ObserveSearchConsoleContext = ObserveOwnerContext & {
  connection: GscPropertyConnectionRecord;
};

export async function requireObserveOwner(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<ObserveOwnerContext> {
  const website = await getWebsiteById(input.websiteId);
  if (!website) {
    throw new Error("Website not found.");
  }

  if (!input.sessionToken) {
    throw new ObserveAuthError(401, "Owner session required.");
  }

  const session = await findOwnerSessionByTokenHash(hashSessionToken(input.sessionToken));
  if (!session || session.websiteId !== input.websiteId) {
    throw new ObserveAuthError(401, "Owner session required.");
  }

  const owner = await findActiveObserveOwner(input.websiteId);
  if (!owner || owner.googleIdentityId !== session.googleIdentityId) {
    throw new ObserveAuthError(403, "Not authorized.");
  }

  const [identity, token] = await Promise.all([
    findGoogleIdentityById(owner.googleIdentityId),
    findGoogleOAuthTokenById(owner.googleOAuthTokenId),
  ]);

  return { website, session, owner, identity, token };
}

export async function requireSearchConsoleConnection(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<ObserveSearchConsoleContext> {
  const context = await requireObserveOwner(input);
  const connection = await findActivePropertyConnection(input.websiteId);
  if (
    !connection ||
    connection.status !== "connected" ||
    connection.googleIdentityId !== context.owner.googleIdentityId
  ) {
    throw new SearchConsoleNotConnectedError();
  }

  return { ...context, connection };
}

export async function resolveObserveOwnerView(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<ObserveOwnerView> {
  const context = await requireObserveOwner(input);
  const connection = await findActivePropertyConnection(input.websiteId);
  const property =
    connection && connection.googleIdentityId === context.owner.googleIdentityId
      ? {
          siteUrl: connection.propertyUri,
          propertyType: connection.propertyType,
          permissionLevel: connection.permissionLevel,
        }
      : null;

  return {
    status: property ? "search_console_connected" : "google_connected",
    email: context.identity?.email ?? null,
    propertySelected: Boolean(property),
    property,
  };
}

export async function disconnectObserveOwner(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<void> {
  const context = await requireObserveOwner(input);
  const token = context.token;
  let refreshToken: string | null = null;
  if (token && token.revokedAt === null && token.refreshTokenCiphertext !== "revoked") {
    try {
      refreshToken = decryptSecret(token.refreshTokenCiphertext);
    } catch {
      refreshToken = null;
    }
  }

  await deleteSearchAnalyticsForWebsite(input.websiteId);
  await revokeActivePropertyConnectionsForWebsite(input.websiteId);
  await revokeObserveOwner(context.owner.id);
  await revokeOwnerSessionsForWebsiteIdentity({
    websiteId: input.websiteId,
    googleIdentityId: context.owner.googleIdentityId,
  });

  const remaining = await countActiveOwnersForIdentity(context.owner.googleIdentityId);
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
