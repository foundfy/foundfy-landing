import { findActivePropertyConnection } from "./db";
import { findLatestCompletedSearchSync, findRunningSearchSync } from "./db-search";
import { addSearchConsoleSite, listSearchConsoleSites } from "./google";
import { SEARCH_PRESENCE_UNCONFIRMED_COPY } from "./google-write";
import { SearchPresenceGoogleError } from "./types";
import {
  authoritativeDomainPropertyUri,
  isExactC0DomainUnverified,
  isUsableGscPermission,
  partitionBindableProperties,
  propertyTypeFromSiteUrl,
  rankGscProperties,
} from "./match";
import { requireObserveOwner } from "./observe";
import { discoverLiveSearchConsole, presenceViewFromDiscovery } from "./presence";
import { bindObserveProperty } from "./properties";
import { getDnsTxtVerificationToken, insertDnsTxtVerification } from "./site-verification";
import { syncSearchAnalytics } from "./sync";
import type { RankedGscProperty, SearchPresenceView } from "./types";

const DNS_RETRY_COPY = "Google may need more time to see the DNS record. You can try again.";

function ignoredClientDomainTarget(_requested: unknown): void {
  // Domain targets are server-derived. Browser-supplied values are ignored.
}

export async function setupSearchPresence(input: {
  websiteId: string;
  sessionToken: string | null;
  requestedDomain?: unknown;
}): Promise<SearchPresenceView> {
  ignoredClientDomainTarget(input.requestedDomain);
  const context = await requireObserveOwner({
    websiteId: input.websiteId,
    sessionToken: input.sessionToken,
  });
  const discovery = await discoverLiveSearchConsole({
    website: context.website,
    token: context.token,
  });

  const bindable = partitionBindableProperties(discovery.ranked);
  if (bindable.likely.length > 0) {
    return presenceViewFromDiscovery(discovery, context.website);
  }

  const unverifiedExact = discovery.ranked.find((property) =>
    isExactC0DomainUnverified(property.siteUrl, property.permissionLevel, context.website),
  );
  if (unverifiedExact) {
    if (!discovery.capabilities.canVerifyNewOwnership) {
      return presenceViewFromDiscovery(discovery, context.website, { ownerChoseSetup: true });
    }
    const dnsTxtToken = await getDnsTxtVerificationToken(
      discovery.accessToken,
      discovery.domain,
    );
    return presenceViewFromDiscovery(discovery, context.website, { dnsTxtToken });
  }

  if (!discovery.hasSetupCapabilities || !discovery.capabilities.canWriteSearchConsole) {
    return presenceViewFromDiscovery(discovery, context.website, { ownerChoseSetup: true });
  }

  const addResult = await addSearchConsoleSite(
    discovery.accessToken,
    discovery.domainPropertyUri,
  );
  const relisted = rankGscProperties(
    await listSearchConsoleSites(discovery.accessToken),
    context.website,
  );
  const nextDiscovery = { ...discovery, ranked: relisted };
  const bindableAfter = partitionBindableProperties(relisted);
  if (bindableAfter.likely.length > 0) {
    return presenceViewFromDiscovery(nextDiscovery, context.website);
  }

  const nextUnverifiedExact = relisted.find((property) =>
    isExactC0DomainUnverified(property.siteUrl, property.permissionLevel, context.website),
  );
  if (nextUnverifiedExact) {
    if (!discovery.capabilities.canVerifyNewOwnership) {
      return presenceViewFromDiscovery(nextDiscovery, context.website, { ownerChoseSetup: true });
    }
    const dnsTxtToken = await getDnsTxtVerificationToken(
      discovery.accessToken,
      discovery.domain,
    );
    return presenceViewFromDiscovery(nextDiscovery, context.website, { dnsTxtToken });
  }

  throw new SearchPresenceGoogleError(
    "invalid",
    SEARCH_PRESENCE_UNCONFIRMED_COPY,
    addResult === "conflict" ? 409 : 502,
  );
}

export async function verifySearchPresence(input: {
  websiteId: string;
  sessionToken: string | null;
  requestedDomain?: unknown;
  requestedToken?: unknown;
}): Promise<SearchPresenceView> {
  ignoredClientDomainTarget(input.requestedDomain);
  void input.requestedToken;
  const context = await requireObserveOwner({
    websiteId: input.websiteId,
    sessionToken: input.sessionToken,
  });
  const discovery = await discoverLiveSearchConsole({
    website: context.website,
    token: context.token,
  });

  const usableExact = discovery.ranked.find(
    (property) =>
      property.siteUrl.trim().toLowerCase() === discovery.domainPropertyUri &&
      isUsableGscPermission(property.permissionLevel),
  );
  if (usableExact) {
    return bindFirstPropertyAndSync({
      websiteId: input.websiteId,
      sessionToken: input.sessionToken,
      property: usableExact,
      discovery,
    });
  }

  const bindable = partitionBindableProperties(discovery.ranked);
  if (bindable.likely.length === 1) {
    return bindFirstPropertyAndSync({
      websiteId: input.websiteId,
      sessionToken: input.sessionToken,
      property: bindable.likely[0]!,
      discovery,
    });
  }
  if (bindable.likely.length > 1) {
    return presenceViewFromDiscovery(discovery, context.website);
  }

  const unverifiedExact = discovery.ranked.find((property) =>
    isExactC0DomainUnverified(property.siteUrl, property.permissionLevel, context.website),
  );
  if (!unverifiedExact) {
    return presenceViewFromDiscovery(discovery, context.website, { ownerChoseSetup: true });
  }

  if (
    !discovery.capabilities.canVerifyNewOwnership ||
    !discovery.capabilities.canWriteSearchConsole
  ) {
    return presenceViewFromDiscovery(discovery, context.website, { ownerChoseSetup: true });
  }

  await insertDnsTxtVerification(discovery.accessToken, discovery.domain);
  const relisted = rankGscProperties(
    await listSearchConsoleSites(discovery.accessToken),
    context.website,
  );
  const nextDiscovery = { ...discovery, ranked: relisted };
  const nowUsableExact = relisted.find(
    (property) =>
      property.siteUrl.trim().toLowerCase() === discovery.domainPropertyUri &&
      isUsableGscPermission(property.permissionLevel),
  );
  if (nowUsableExact) {
    return bindFirstPropertyAndSync({
      websiteId: input.websiteId,
      sessionToken: input.sessionToken,
      property: nowUsableExact,
      discovery: nextDiscovery,
    });
  }

  const stillPending = relisted.find((property) =>
    isExactC0DomainUnverified(property.siteUrl, property.permissionLevel, context.website),
  );
  if (!stillPending) {
    throw new SearchPresenceGoogleError("invalid", SEARCH_PRESENCE_UNCONFIRMED_COPY, 502);
  }

  const dnsTxtToken = await getDnsTxtVerificationToken(
    discovery.accessToken,
    discovery.domain,
  );
  return presenceViewFromDiscovery(nextDiscovery, context.website, {
    dnsTxtToken,
    retryMessage: DNS_RETRY_COPY,
  });
}

async function bindFirstPropertyAndSync(input: {
  websiteId: string;
  sessionToken: string | null;
  property: RankedGscProperty;
  discovery: Awaited<ReturnType<typeof discoverLiveSearchConsole>>;
}): Promise<SearchPresenceView> {
  const bound = await bindObserveProperty({
    websiteId: input.websiteId,
    sessionToken: input.sessionToken,
    siteUrl: input.property.siteUrl,
  });
  const searchAnalytics = await startInitialSearchAnalyticsSyncOnce({
    websiteId: input.websiteId,
    sessionToken: input.sessionToken,
  });
  const connection = await findActivePropertyConnection(input.websiteId);
  const running = connection
    ? await findRunningSearchSync(input.websiteId, connection.id)
    : null;
  const completed = connection
    ? await findLatestCompletedSearchSync(input.websiteId, connection.id)
    : null;

  return presenceViewFromDiscovery(
    input.discovery,
    { hostname: input.discovery.domain },
    {
      boundUsable: true,
      hasCompletedSync: Boolean(completed) || searchAnalytics?.status === "completed",
      hasRunningSync: Boolean(running) && searchAnalytics?.status !== "completed",
      property: {
        siteUrl: bound.siteUrl,
        propertyType: bound.propertyType ?? propertyTypeFromSiteUrl(bound.siteUrl),
        permissionLevel: bound.permissionLevel,
      },
      searchAnalytics,
    },
  );
}

async function startInitialSearchAnalyticsSyncOnce(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<SearchPresenceView["searchAnalytics"]> {
  const connection = await findActivePropertyConnection(input.websiteId);
  if (!connection) {
    return null;
  }

  const running = await findRunningSearchSync(input.websiteId, connection.id);
  const completed = await findLatestCompletedSearchSync(input.websiteId, connection.id);
  if (running || completed) {
    return null;
  }

  // EXISTING NON-BLOCKING SYNC CONCURRENCY LIMITATION:
  // overlapping user-initiated Sync clicks can still create concurrent running rows.
  try {
    return await syncSearchAnalytics({
      websiteId: input.websiteId,
      sessionToken: input.sessionToken,
    });
  } catch {
    return null;
  }
}

export function c0TargetDomainPropertyUri(hostname: string): string {
  return authoritativeDomainPropertyUri({ hostname });
}
