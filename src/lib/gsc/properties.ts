import { removeGoogleDerivedOwnerDataForWebsite } from "@/lib/actions/google-privacy";
import { findActivePropertyConnection, upsertActivePropertyConnection } from "./db";
import { isUsableGscPermission, propertyTypeFromSiteUrl } from "./match";
import { requireObserveOwner } from "./observe";
import { discoverLiveSearchConsole, presenceViewFromDiscovery, toObservePropertyList } from "./presence";
import {
  GoogleAuthExpiredError,
  UnverifiedPropertyError,
  type ObservePropertyList,
} from "./types";

export async function listObserveProperties(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<ObservePropertyList> {
  const context = await requireObserveOwner(input);
  if (!context.token || context.token.revokedAt) {
    throw new GoogleAuthExpiredError();
  }

  const discovery = await discoverLiveSearchConsole({
    website: context.website,
    token: context.token,
  });
  return toObservePropertyList(presenceViewFromDiscovery(discovery, context.website));
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

  const context = await requireObserveOwner(input);
  if (!context.token || context.token.revokedAt) {
    throw new GoogleAuthExpiredError();
  }

  const discovery = await discoverLiveSearchConsole({
    website: context.website,
    token: context.token,
  });
  const verified = discovery.ranked.find((property) => property.siteUrl === siteUrl);
  if (!verified || !isUsableGscPermission(verified.permissionLevel)) {
    throw new UnverifiedPropertyError();
  }

  const existing = await findActivePropertyConnection(input.websiteId);
  if (existing && existing.propertyUri !== verified.siteUrl) {
    await removeGoogleDerivedOwnerDataForWebsite(input.websiteId);
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
