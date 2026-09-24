import { deleteDecisionEngineForWebsite } from "@/lib/decisions/db";
import { decryptSecret } from "./crypto";
import { findActivePropertyConnection, upsertActivePropertyConnection } from "./db";
import { deleteSearchAnalyticsForWebsite } from "./db-search";
import { listSearchConsoleSites, refreshGoogleAccessToken } from "./google";
import { partitionRankedProperties, propertyTypeFromSiteUrl, rankGscProperties } from "./match";
import { requireObserveOwner } from "./observe";
import {
  GoogleAuthExpiredError,
  UnverifiedPropertyError,
  type ObservePropertyList,
  type RankedGscProperty,
} from "./types";

function readRefreshToken(ciphertext: string | undefined): string {
  if (!ciphertext || ciphertext === "revoked") {
    throw new GoogleAuthExpiredError();
  }

  try {
    return decryptSecret(ciphertext);
  } catch {
    throw new GoogleAuthExpiredError();
  }
}

async function loadAccessibleProperties(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<{
  context: Awaited<ReturnType<typeof requireObserveOwner>>;
  ranked: RankedGscProperty[];
}> {
  const context = await requireObserveOwner(input);
  if (!context.token || context.token.revokedAt) {
    throw new GoogleAuthExpiredError();
  }

  const refreshToken = readRefreshToken(context.token.refreshTokenCiphertext);
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  const sites = await listSearchConsoleSites(accessToken);
  const ranked = rankGscProperties(sites, context.website);

  return { context, ranked };
}

export async function listObserveProperties(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<ObservePropertyList> {
  const { ranked } = await loadAccessibleProperties(input);
  return partitionRankedProperties(ranked);
}

export async function bindObserveProperty(input: {
  websiteId: string;
  sessionToken: string | null;
  siteUrl: string | null;
}): Promise<ObservePropertyList["likely"][number] & { siteUrl: string }> {
  const siteUrl = input.siteUrl?.trim() ?? "";
  if (!siteUrl) {
    throw new UnverifiedPropertyError();
  }

  const { context, ranked } = await loadAccessibleProperties(input);
  const verified = ranked.find((property) => property.siteUrl === siteUrl);
  if (!verified) {
    throw new UnverifiedPropertyError();
  }

  const existing = await findActivePropertyConnection(input.websiteId);
  if (existing && existing.propertyUri !== verified.siteUrl) {
    await deleteDecisionEngineForWebsite(input.websiteId);
    await deleteSearchAnalyticsForWebsite(input.websiteId);
  }

  const stored = await upsertActivePropertyConnection({
    websiteId: input.websiteId,
    observeOwnerId: context.owner.id,
    googleIdentityId: context.owner.googleIdentityId,
    propertyUri: verified.siteUrl,
    propertyType: verified.propertyType ?? propertyTypeFromSiteUrl(verified.siteUrl),
    permissionLevel: verified.permissionLevel,
  });

  return {
    siteUrl: stored.propertyUri,
    propertyType: stored.propertyType,
    permissionLevel: stored.permissionLevel,
    match: verified.match,
  };
}
