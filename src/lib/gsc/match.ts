import type { WebsiteRecord } from "@/lib/websites/types";
import type {
  GscPropertyMatch,
  GscPropertyType,
  RankedGscProperty,
} from "./types";

const MATCH_RANK: Record<GscPropertyMatch, number> = {
  exact_domain: 0,
  exact_url_prefix: 1,
  related_host: 2,
  not_a_match: 3,
};

export type GoogleSiteEntry = {
  siteUrl: string;
  permissionLevel: string | null;
};

export function stripWww(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, "");
}

export function propertyTypeFromSiteUrl(siteUrl: string): GscPropertyType {
  return siteUrl.toLowerCase().startsWith("sc-domain:") ? "domain" : "url_prefix";
}

function displayHost(website: Pick<WebsiteRecord, "hostname" | "displayUrl">): string {
  try {
    return new URL(website.displayUrl).hostname.toLowerCase();
  } catch {
    return website.hostname.toLowerCase();
  }
}

function displayProtocol(website: Pick<WebsiteRecord, "displayUrl">): string {
  try {
    return new URL(website.displayUrl).protocol;
  } catch {
    return "https:";
  }
}

export function classifyGscProperty(
  siteUrl: string,
  website: Pick<WebsiteRecord, "hostname" | "displayUrl">,
): GscPropertyMatch {
  const websiteHost = stripWww(website.hostname);
  if (!websiteHost) {
    return "not_a_match";
  }

  if (siteUrl.toLowerCase().startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length);
    return stripWww(domain) === websiteHost ? "exact_domain" : "not_a_match";
  }

  let parsed: URL;
  try {
    parsed = new URL(siteUrl);
  } catch {
    return "not_a_match";
  }

  if (stripWww(parsed.hostname) !== websiteHost) {
    return "not_a_match";
  }

  const path = parsed.pathname === "" ? "/" : parsed.pathname;
  const hostMatchesDisplay = parsed.hostname.toLowerCase() === displayHost(website);
  const protocolMatchesDisplay = parsed.protocol === displayProtocol(website);
  const isSiteRoot = path === "/";

  if (hostMatchesDisplay && protocolMatchesDisplay && isSiteRoot) {
    return "exact_url_prefix";
  }

  return "related_host";
}

export function rankGscProperties(
  sites: GoogleSiteEntry[],
  website: Pick<WebsiteRecord, "hostname" | "displayUrl">,
): RankedGscProperty[] {
  return sites
    .map((site) => ({
      siteUrl: site.siteUrl,
      propertyType: propertyTypeFromSiteUrl(site.siteUrl),
      permissionLevel: site.permissionLevel,
      match: classifyGscProperty(site.siteUrl, website),
    }))
    .sort((left, right) => {
      const rankDelta = MATCH_RANK[left.match] - MATCH_RANK[right.match];
      if (rankDelta !== 0) {
        return rankDelta;
      }
      return left.siteUrl.localeCompare(right.siteUrl);
    });
}

export function partitionRankedProperties(ranked: RankedGscProperty[]): {
  recommendedSiteUrl: string | null;
  likely: RankedGscProperty[];
  other: RankedGscProperty[];
} {
  const likely = ranked.filter((property) => property.match !== "not_a_match");
  const other = ranked.filter((property) => property.match === "not_a_match");

  return {
    recommendedSiteUrl: likely[0]?.siteUrl ?? null,
    likely,
    other,
  };
}
