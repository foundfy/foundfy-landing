import type { StoredObservation } from "@/lib/observations/types";
import { MAX_PAGES_PER_CRAWL } from "@/lib/crawler/types";
import { normalizeComparisonUrl } from "@/lib/findings/comparison/normalize-comparison-url";
import { isSameSite, normalizeCrawlUrl } from "@/lib/crawler/url/normalize";

const SITE_WIDE_RULES = new Set([
  "site_discovery.robots_txt_missing",
  "site_discovery.sitemap_missing",
]);

const EVIDENCE_URL_KEYS = [
  "finalUrl",
  "requestedUrl",
  "queueUrl",
  "sitemapUrl",
  "linkToUrl",
] as const;

function isNonPageArtifact(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return (
      pathname.endsWith("/robots.txt") ||
      pathname === "/robots.txt" ||
      pathname.endsWith(".xml")
    );
  } catch {
    return true;
  }
}

function collectEvidenceUrls(observation: StoredObservation): string[] {
  if (SITE_WIDE_RULES.has(observation.ruleKey)) {
    return [];
  }

  const urls: string[] = [];

  for (const key of EVIDENCE_URL_KEYS) {
    const value = observation.evidence[key];
    if (typeof value === "string" && value.trim()) {
      urls.push(value);
    }
  }

  if (observation.pageUrl?.trim()) {
    urls.push(observation.pageUrl);
  }

  return urls;
}

export function extractFindingRecrawlUrls(
  observations: Array<Pick<StoredObservation, "ruleKey" | "pageUrl" | "evidence">>,
): string[] {
  const urls: string[] = [];

  for (const observation of observations) {
    urls.push(...collectEvidenceUrls(observation as StoredObservation));
  }

  return urls;
}

export function selectFindingRecrawlUrls(
  candidates: string[],
  input: {
    seedUrl: string;
    hostname: string;
    origin?: string;
    limit?: number;
  },
): string[] {
  const limit = input.limit ?? Math.max(0, MAX_PAGES_PER_CRAWL - 1);
  const origin = input.origin;
  const selected: string[] = [];
  const seen = new Set<string>();

  const seedKey = normalizeComparisonUrl(input.seedUrl, origin);
  if (seedKey) {
    seen.add(seedKey);
  }

  for (const candidate of candidates) {
    if (selected.length >= limit) {
      break;
    }

    const normalized = normalizeCrawlUrl(candidate, origin);
    const dedupeKey = normalizeComparisonUrl(candidate, origin);
    if (!normalized || !dedupeKey || seen.has(dedupeKey)) {
      continue;
    }

    if (!isSameSite(normalized, input.hostname)) {
      continue;
    }

    if (isNonPageArtifact(normalized)) {
      continue;
    }

    seen.add(dedupeKey);
    selected.push(normalized);
  }

  return selected;
}
