import { normalizeComparisonUrl } from "@/lib/findings/comparison/normalize-comparison-url";
import { normalizeCrawlUrl } from "../url/normalize";

export type PageHostEvidence = {
  requestedUrl: string;
  finalUrl: string;
  canonical: string | null;
  contentHash: string | null;
  redirectChain: Array<{ url: string }>;
  statusCode: number;
};

export type HostVariantRelation = "equivalent" | "conflicting" | "unknown";

const USABLE_STATUS_MIN = 200;
const USABLE_STATUS_MAX = 399;

export function hostVariantPairKey(url: string, origin?: string): string | null {
  const compared = normalizeComparisonUrl(url, origin);
  if (!compared) {
    return null;
  }

  try {
    const parsed = new URL(compared);
    parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function sampleIdentityKey(url: string, origin?: string): string | null {
  return normalizeCrawlUrl(url, origin);
}

function hostnameOf(url: string, origin?: string): string | null {
  const normalized = sampleIdentityKey(url, origin) ?? url;
  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function apexHostname(hostname: string): string {
  return hostname.replace(/^www\./, "");
}

function isWwwApexHostnamePair(leftHost: string, rightHost: string): boolean {
  if (leftHost === rightHost) {
    return false;
  }

  return (
    apexHostname(leftHost) === apexHostname(rightHost) &&
    leftHost.startsWith("www.") !== rightHost.startsWith("www.")
  );
}

export function isWwwApexHostVariantPair(
  leftUrl: string,
  rightUrl: string,
  origin?: string,
): boolean {
  const pair = hostVariantPairKey(leftUrl, origin);
  if (!pair || pair !== hostVariantPairKey(rightUrl, origin)) {
    return false;
  }

  const leftHost = hostnameOf(leftUrl, origin);
  const rightHost = hostnameOf(rightUrl, origin);
  return Boolean(leftHost && rightHost && isWwwApexHostnamePair(leftHost, rightHost));
}

function isUsablePage(page: PageHostEvidence | undefined): page is PageHostEvidence {
  return Boolean(
    page &&
      page.statusCode >= USABLE_STATUS_MIN &&
      page.statusCode <= USABLE_STATUS_MAX,
  );
}

function usableHash(page: PageHostEvidence | undefined): string | null {
  if (!isUsablePage(page) || !page.contentHash) {
    return null;
  }

  return page.contentHash;
}

function sameNormalized(left: string | null | undefined, right: string | null | undefined, origin?: string): boolean {
  if (!left || !right) {
    return false;
  }

  const leftKey = sampleIdentityKey(left, origin);
  const rightKey = sampleIdentityKey(right, origin);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function latestUsableEvidence(
  evidence: PageHostEvidence[],
  url: string,
  origin?: string,
): PageHostEvidence | undefined {
  const identity = sampleIdentityKey(url, origin);
  if (!identity) {
    return undefined;
  }

  return evidence.find((page) => {
    if (!isUsablePage(page)) {
      return false;
    }

    return sampleIdentityKey(page.requestedUrl, origin) === identity;
  });
}

function pagePointsTo(page: PageHostEvidence, targetUrl: string, origin?: string): boolean {
  if (sameNormalized(page.finalUrl, targetUrl, origin)) {
    return true;
  }

  return page.redirectChain.some((hop) => sameNormalized(hop.url, targetUrl, origin));
}

function canonicalPointsTo(page: PageHostEvidence, targetUrl: string, origin?: string): boolean {
  return Boolean(page.canonical && sameNormalized(page.canonical, targetUrl, origin));
}

export function classifyWwwApexRelation(
  leftUrl: string,
  rightUrl: string,
  evidence: PageHostEvidence[],
  origin?: string,
): HostVariantRelation {
  if (!isWwwApexHostVariantPair(leftUrl, rightUrl, origin)) {
    return "unknown";
  }

  const left = latestUsableEvidence(evidence, leftUrl, origin);
  const right = latestUsableEvidence(evidence, rightUrl, origin);
  const leftHash = usableHash(left);
  const rightHash = usableHash(right);

  if (leftHash && rightHash && leftHash !== rightHash) {
    return "conflicting";
  }

  if (leftHash && rightHash && leftHash === rightHash) {
    return "equivalent";
  }

  if (left && right && sameNormalized(left.finalUrl, right.finalUrl, origin)) {
    return "equivalent";
  }

  if (left && pagePointsTo(left, rightUrl, origin)) {
    return "equivalent";
  }

  if (right && pagePointsTo(right, leftUrl, origin)) {
    return "equivalent";
  }

  if (
    left &&
    right &&
    left.canonical &&
    right.canonical &&
    sameNormalized(left.canonical, right.canonical, origin)
  ) {
    return "equivalent";
  }

  if (left && canonicalPointsTo(left, rightUrl, origin)) {
    return "equivalent";
  }

  if (right && canonicalPointsTo(right, leftUrl, origin)) {
    return "equivalent";
  }

  return "unknown";
}

function inferredPreferredHost(
  urls: string[],
  evidence: PageHostEvidence[],
  origin?: string,
): string | null {
  const hosts = new Set<string>();

  for (const url of urls) {
    const page = latestUsableEvidence(evidence, url, origin);
    if (!page) {
      continue;
    }

    const finalHost = hostnameOf(page.finalUrl, origin);
    if (finalHost) {
      hosts.add(finalHost);
    }

    if (page.canonical) {
      const canonicalHost = hostnameOf(page.canonical, origin);
      if (canonicalHost) {
        hosts.add(canonicalHost);
      }
    }
  }

  if (hosts.size === 1) {
    return [...hosts][0] ?? null;
  }

  return null;
}

export function preferHostVariant(
  urls: string[],
  input: {
    seedUrl?: string;
    hostname?: string;
    evidence?: PageHostEvidence[];
    origin?: string;
  } = {},
): string {
  const unique: string[] = [];
  for (const url of urls) {
    if (!unique.some((existing) => sameNormalized(existing, url, input.origin))) {
      unique.push(url);
    }
  }

  if (unique.length <= 1) {
    return unique[0] ?? urls[0] ?? "";
  }

  const seedHost = input.seedUrl ? hostnameOf(input.seedUrl, input.origin) : null;
  if (seedHost) {
    const seedMatch = unique.find((url) => hostnameOf(url, input.origin) === seedHost);
    if (seedMatch) {
      return seedMatch;
    }
  }

  if (input.hostname) {
    const hostnameMatch = unique.find((url) => hostnameOf(url, input.origin) === input.hostname);
    if (hostnameMatch) {
      return hostnameMatch;
    }
  }

  const inferredHost = inferredPreferredHost(unique, input.evidence ?? [], input.origin);
  if (inferredHost) {
    const inferredMatch = unique.find((url) => hostnameOf(url, input.origin) === inferredHost);
    if (inferredMatch) {
      return inferredMatch;
    }
  }

  return unique[0] ?? urls[0] ?? "";
}

function pairRelationFor(
  urls: string[],
  evidence: PageHostEvidence[],
  origin?: string,
): HostVariantRelation {
  let relation: HostVariantRelation = "unknown";

  for (let i = 0; i < urls.length; i += 1) {
    for (let j = i + 1; j < urls.length; j += 1) {
      const left = urls[i];
      const right = urls[j];
      if (!left || !right || !isWwwApexHostVariantPair(left, right, origin)) {
        continue;
      }

      const next = classifyWwwApexRelation(left, right, evidence, origin);
      if (next === "conflicting") {
        return "conflicting";
      }
      if (next === "equivalent") {
        relation = "equivalent";
      }
    }
  }

  return relation;
}

export function createSampleSelectionKey(input: {
  urls: string[];
  evidence?: PageHostEvidence[];
  origin?: string;
}): (url: string) => string | null {
  const evidence = input.evidence ?? [];
  const origin = input.origin;
  const pairGroups = new Map<string, string[]>();

  for (const url of input.urls) {
    const pair = hostVariantPairKey(url, origin);
    if (!pair) {
      continue;
    }

    const group = pairGroups.get(pair) ?? [];
    if (!group.includes(url)) {
      group.push(url);
    }
    pairGroups.set(pair, group);
  }

  const relationByPair = new Map<string, HostVariantRelation>();
  for (const [pair, urls] of pairGroups) {
    relationByPair.set(pair, pairRelationFor(urls, evidence, origin));
  }

  return (url: string) => {
    const pair = hostVariantPairKey(url, origin);
    const identity = sampleIdentityKey(url, origin);
    if (!pair) {
      return identity;
    }

    if (relationByPair.get(pair) === "conflicting") {
      return identity;
    }

    return pair;
  };
}

export function shouldSkipEquivalentHostVariant(input: {
  requestedUrl: string;
  crawledUrls: string[];
  evidence: PageHostEvidence[];
  origin?: string;
}): boolean {
  const requested = sampleIdentityKey(input.requestedUrl, input.origin);
  if (!requested) {
    return false;
  }

  for (const crawled of input.crawledUrls) {
    if (sameNormalized(crawled, input.requestedUrl, input.origin)) {
      continue;
    }

    if (classifyWwwApexRelation(input.requestedUrl, crawled, input.evidence, input.origin) === "equivalent") {
      return true;
    }
  }

  return false;
}

export function collapseLatestPageEvidence(pages: PageHostEvidence[], origin?: string): PageHostEvidence[] {
  const latest = new Map<string, PageHostEvidence>();

  for (const page of pages) {
    const key = sampleIdentityKey(page.requestedUrl, origin);
    if (!key || latest.has(key)) {
      continue;
    }
    latest.set(key, page);
  }

  return [...latest.values()];
}

export function omitRedundantEquivalentHostVariants<T extends { url: string }>(
  items: T[],
  input: {
    seedUrl?: string;
    hostname?: string;
    evidence?: PageHostEvidence[];
    origin?: string;
  } = {},
): T[] {
  const evidence = input.evidence ?? [];
  if (evidence.length === 0) {
    return items;
  }

  const kept: T[] = [];

  for (const item of items) {
    const equivalentIndex = kept.findIndex(
      (existing) => classifyWwwApexRelation(existing.url, item.url, evidence, input.origin) === "equivalent",
    );
    if (equivalentIndex < 0) {
      kept.push(item);
      continue;
    }

    const existing = kept[equivalentIndex];
    if (!existing) {
      kept.push(item);
      continue;
    }

    const preferred = preferHostVariant([existing.url, item.url], input);
    if (preferred === item.url) {
      kept[equivalentIndex] = item;
    }
  }

  return kept;
}
