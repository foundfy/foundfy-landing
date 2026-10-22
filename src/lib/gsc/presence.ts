import type { WebsiteRecord } from "@/lib/websites/types";
import { decryptSecret } from "./crypto";
import { listSearchConsoleSites, refreshGoogleAccessToken } from "./google";
import {
  authoritativeDomainPropertyUri,
  isExactC0DomainUnverified,
  isUsableGscPermission,
  normalizedWebsiteHost,
  partitionBindableProperties,
  rankGscProperties,
} from "./match";
import { googleCapabilitiesFromScopes, hasSearchPresenceSetupCapabilities } from "./scopes";
import {
  GoogleAuthExpiredError,
  type GoogleOAuthTokenRecord,
  type ObservePropertyList,
  type RankedGscProperty,
  type SearchPresenceState,
  type SearchPresenceView,
} from "./types";

export type LiveSearchConsoleDiscovery = {
  accessToken: string;
  ranked: RankedGscProperty[];
  capabilities: ReturnType<typeof googleCapabilitiesFromScopes>;
  hasSetupCapabilities: boolean;
  domain: string;
  domainPropertyUri: string;
};

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

export function deriveSearchPresenceState(input: {
  boundUsable: boolean;
  hasCompletedSync: boolean;
  hasRunningSync: boolean;
  hasUsableMatchingProperty: boolean;
  hasExactDomainUnverified: boolean;
  ownerChoseSetup: boolean;
  hasSetupCapabilities: boolean;
}): SearchPresenceState {
  if (input.boundUsable) {
    if (input.hasRunningSync || !input.hasCompletedSync) {
      return "VERIFIED_SYNC_PENDING";
    }
    return "GSC_CONNECTED";
  }

  if (input.hasUsableMatchingProperty) {
    return "MATCHING_GSC_PROPERTY_AVAILABLE";
  }

  if (input.hasExactDomainUnverified) {
    return "PROPERTY_ADDED_VERIFICATION_PENDING";
  }

  if (input.ownerChoseSetup && !input.hasSetupCapabilities) {
    return "PROPERTY_SETUP_AUTH_REQUIRED";
  }

  return "NO_MATCHING_PROPERTY_IN_CONNECTED_ACCOUNT";
}

export function hasExactC0DomainUnverifiedProperty(
  ranked: RankedGscProperty[],
  website: Pick<WebsiteRecord, "hostname">,
): boolean {
  const domainPropertyUri = authoritativeDomainPropertyUri(website);
  return ranked.some(
    (property) =>
      property.siteUrl.trim().toLowerCase() === domainPropertyUri &&
      isExactC0DomainUnverified(property.siteUrl, property.permissionLevel, website),
  );
}

export async function discoverLiveSearchConsole(input: {
  website: Pick<WebsiteRecord, "hostname" | "displayUrl">;
  token: GoogleOAuthTokenRecord | null;
}): Promise<LiveSearchConsoleDiscovery> {
  if (!input.token || input.token.revokedAt) {
    throw new GoogleAuthExpiredError();
  }

  const capabilities = googleCapabilitiesFromScopes(input.token.scopes);
  if (!capabilities.canReadSearchConsole) {
    throw new GoogleAuthExpiredError();
  }

  const refreshToken = readRefreshToken(input.token.refreshTokenCiphertext);
  const accessToken = await refreshGoogleAccessToken(refreshToken);
  const sites = await listSearchConsoleSites(accessToken);
  const ranked = rankGscProperties(sites, input.website);

  return {
    accessToken,
    ranked,
    capabilities,
    hasSetupCapabilities: hasSearchPresenceSetupCapabilities(input.token.scopes),
    domain: normalizedWebsiteHost(input.website),
    domainPropertyUri: authoritativeDomainPropertyUri(input.website),
  };
}

export function presenceViewFromDiscovery(
  discovery: LiveSearchConsoleDiscovery,
  website: Pick<WebsiteRecord, "hostname">,
  options?: {
    ownerChoseSetup?: boolean;
    dnsTxtToken?: string | null;
    retryMessage?: string | null;
    boundUsable?: boolean;
    hasCompletedSync?: boolean;
    hasRunningSync?: boolean;
    property?: SearchPresenceView["property"];
    searchAnalytics?: SearchPresenceView["searchAnalytics"];
  },
): SearchPresenceView {
  const bindable = partitionBindableProperties(discovery.ranked);
  const presenceState = deriveSearchPresenceState({
    boundUsable: options?.boundUsable ?? false,
    hasCompletedSync: options?.hasCompletedSync ?? false,
    hasRunningSync: options?.hasRunningSync ?? false,
    hasUsableMatchingProperty: bindable.likely.length > 0,
    hasExactDomainUnverified: hasExactC0DomainUnverifiedProperty(discovery.ranked, website),
    ownerChoseSetup: options?.ownerChoseSetup ?? false,
    hasSetupCapabilities: discovery.hasSetupCapabilities,
  });

  return {
    recommendedSiteUrl: bindable.recommendedSiteUrl,
    likely: bindable.likely,
    other: bindable.other,
    presenceState,
    domain: discovery.domain,
    domainPropertyUri: discovery.domainPropertyUri,
    dnsTxtToken: options?.dnsTxtToken ?? null,
    retryMessage: options?.retryMessage ?? null,
    property: options?.property ?? null,
    searchAnalytics: options?.searchAnalytics ?? null,
  };
}

export function toObservePropertyList(view: SearchPresenceView): ObservePropertyList {
  return {
    recommendedSiteUrl: view.recommendedSiteUrl,
    likely: view.likely,
    other: view.other,
    presenceState: view.presenceState,
    domain: view.domain,
    domainPropertyUri: view.domainPropertyUri,
  };
}
