import { isSameSite, normalizeCrawlUrl } from "../url/normalize";
import { MAX_PAGES_PER_CRAWL } from "../types";
import {
  classifyPagePath,
  rankDiscoveredUrls,
  selectRepresentativeUrls,
  type DiscoverySource,
  type PathClass,
} from "./page-priority";
import {
  classifyWwwApexRelation,
  createSampleSelectionKey,
  hostVariantPairKey,
  omitRedundantEquivalentHostVariants,
  preferHostVariant,
  type PageHostEvidence,
} from "./host-variant-equivalence";

export const STRUCTURAL_RESERVE_SLOTS = 6;
export const GSC_RESERVE_SLOTS = 3;
export const GSC_INJECT_LIMIT = 10;
export const GSC_QUEUE_PRIORITY = 88;
export const SELECTED_STRUCTURAL_PRIORITY = 97;
export const SELECTED_FILLER_PRIORITY = 70;
export const UNSELECTED_QUEUE_PRIORITY = 1;

export const STRUCTURAL_PATH_CLASSES = new Set<PathClass>([
  "homepage",
  "identity",
  "locale_home",
  "category_service",
]);

export type CandidateSource = DiscoverySource | "verification";
export type SelectionSource = CandidateSource | "gsc_visibility";
export type SelectionReason =
  | "seed"
  | "homepage"
  | "identity"
  | "locale_home"
  | "category_service"
  | "gsc_visibility"
  | "priority_queue"
  | "sitemap"
  | "navigation"
  | "internal";

export type GscVisibilityPage = {
  url: string;
  impressions: number;
  clicks: number;
};

export type SelectedCrawlUrl = {
  url: string;
  source: SelectionSource;
  reason: SelectionReason;
};

export type CrawlCandidate = {
  url: string;
  source: CandidateSource;
};

const STRUCTURAL_REASON_BY_CLASS: Record<
  "homepage" | "identity" | "locale_home" | "category_service",
  SelectionReason
> = {
  homepage: "homepage",
  identity: "identity",
  locale_home: "locale_home",
  category_service: "category_service",
};

export function isGscVisibilityQueuePriority(priority: number): boolean {
  return priority === GSC_QUEUE_PRIORITY;
}

export function gscDemandScore(
  page: Pick<GscVisibilityPage, "impressions" | "clicks">,
  maxImpressions: number,
): number {
  if (maxImpressions <= 0) {
    return page.clicks > 0 ? 15 : 0;
  }

  const ratio = page.impressions / maxImpressions;
  const clickBoost = page.clicks > 0 ? 15 : 0;
  return Math.min(100, Math.round(ratio * 85 + clickBoost));
}

export function gscDedupeKey(url: string, origin?: string): string | null {
  return hostVariantPairKey(url, origin);
}

export type { PageHostEvidence };

export function toDiscoverySource(source: CandidateSource): DiscoverySource {
  return source === "verification" ? "navigation" : source;
}

function reasonForCandidate(url: string, source: CandidateSource): SelectionReason {
  if (source === "seed") {
    return "seed";
  }

  const pathClass = classifyPagePath(url);
  if (pathClass === "homepage" || pathClass === "identity" || pathClass === "locale_home" || pathClass === "category_service") {
    return STRUCTURAL_REASON_BY_CLASS[pathClass];
  }

  if (source === "sitemap" || source === "navigation" || source === "internal") {
    return source;
  }

  return "priority_queue";
}

function isOnSite(url: string, hostname?: string): boolean {
  return !hostname || isSameSite(url, hostname);
}

export function rankGscVisibilityPages(
  pages: GscVisibilityPage[],
  input: { hostname?: string; origin?: string } = {},
): GscVisibilityPage[] {
  const maxImpressions = pages.reduce((max, page) => Math.max(max, page.impressions), 0);
  const bestByKey = new Map<string, GscVisibilityPage>();

  for (const page of pages) {
    if (!page.url || !isOnSite(page.url, input.hostname)) {
      continue;
    }

    if (classifyPagePath(page.url) === "utility") {
      continue;
    }

    if (page.impressions <= 0 && page.clicks <= 0) {
      continue;
    }

    const key = gscDedupeKey(page.url, input.origin);
    if (!key) {
      continue;
    }

    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, page);
      continue;
    }

    const incomingScore = gscDemandScore(page, maxImpressions);
    const existingScore = gscDemandScore(existing, maxImpressions);
    if (incomingScore > existingScore) {
      bestByKey.set(key, page);
    }
  }

  return [...bestByKey.values()].sort((left, right) => {
    const demandDiff = gscDemandScore(right, maxImpressions) - gscDemandScore(left, maxImpressions);
    if (demandDiff !== 0) {
      return demandDiff;
    }

    return left.url.localeCompare(right.url);
  });
}

function strongerCandidateSource(left: CandidateSource, right: CandidateSource): CandidateSource {
  const rank: Record<CandidateSource, number> = {
    seed: 4,
    verification: 3,
    navigation: 2,
    sitemap: 1,
    internal: 0,
  };

  return (rank[left] ?? 0) >= (rank[right] ?? 0) ? left : right;
}

function addSelected(
  selected: SelectedCrawlUrl[],
  selectedKeys: Set<string>,
  item: SelectedCrawlUrl,
  input: {
    limit: number;
    origin?: string;
    hostname?: string;
    keyFor: (url: string) => string | null;
  },
): boolean {
  if (selected.length >= input.limit) {
    return false;
  }

  if (!isOnSite(item.url, input.hostname)) {
    return false;
  }

  const key = input.keyFor(item.url);
  if (!key || selectedKeys.has(key)) {
    return false;
  }

  selectedKeys.add(key);
  selected.push(item);
  return true;
}

export function selectGscInformedCrawlUrls(input: {
  seedUrl: string;
  candidates: CrawlCandidate[];
  gscPages?: GscVisibilityPage[];
  alreadyCrawledUrls?: string[];
  limit?: number;
  origin?: string;
  hostname?: string;
  evidence?: PageHostEvidence[];
}): SelectedCrawlUrl[] {
  const limit = input.limit ?? MAX_PAGES_PER_CRAWL;
  const origin = input.origin;
  const hostname = input.hostname;
  const evidence = input.evidence ?? [];
  const gscPages = rankGscVisibilityPages(input.gscPages ?? [], { hostname, origin });
  const urlsInPlay = [
    input.seedUrl,
    ...input.candidates.map((candidate) => candidate.url),
    ...gscPages.map((page) => page.url),
    ...(input.alreadyCrawledUrls ?? []),
  ];
  const keyFor = createSampleSelectionKey({ urls: urlsInPlay, evidence, origin });
  const selected: SelectedCrawlUrl[] = [];
  const selectedKeys = new Set<string>();
  const add = (item: SelectedCrawlUrl) =>
    addSelected(selected, selectedKeys, item, { limit, origin, hostname, keyFor });

  const candidateByKey = new Map<string, CrawlCandidate>();
  for (const candidate of input.candidates) {
    const key = keyFor(candidate.url);
    if (!key) {
      continue;
    }

    const existing = candidateByKey.get(key);
    if (!existing) {
      candidateByKey.set(key, candidate);
      continue;
    }

    if (classifyWwwApexRelation(existing.url, candidate.url, evidence, origin) !== "equivalent") {
      continue;
    }

    const preferredUrl = preferHostVariant([existing.url, candidate.url], {
      seedUrl: input.seedUrl,
      hostname,
      evidence,
      origin,
    });
    candidateByKey.set(key, {
      url: preferredUrl,
      source: strongerCandidateSource(existing.source, candidate.source),
    });
  }

  const preference = {
    seedUrl: input.seedUrl,
    hostname,
    evidence,
    origin,
  };

  for (const url of input.alreadyCrawledUrls ?? []) {
    const candidate = candidateByKey.get(keyFor(url) ?? "");
    add({
      url,
      source: candidate?.source === "seed" || keyFor(url) === keyFor(input.seedUrl)
        ? "seed"
        : candidate?.source ?? "internal",
      reason:
        candidate?.source === "seed" || keyFor(url) === keyFor(input.seedUrl)
          ? "seed"
          : reasonForCandidate(url, candidate?.source ?? "internal"),
    });
  }

  if (gscPages.length === 0) {
    const representativeCandidates = omitRedundantEquivalentHostVariants(input.candidates, preference);
    const allCandidates = representativeCandidates.map((candidate) => ({
      url: candidate.url,
      source: toDiscoverySource(candidate.source),
    }));
    const sourceByUrl = new Map(representativeCandidates.map((candidate) => [candidate.url, candidate.source]));

    if (selected.length === 0) {
      return selectRepresentativeUrls(allCandidates, limit).map((url) => {
        const source = sourceByUrl.get(url) ?? "internal";
        return {
          url,
          source,
          reason: reasonForCandidate(url, source),
        };
      });
    }

    const remainingCandidates = representativeCandidates.filter((candidate) => {
      const key = keyFor(candidate.url);
      return Boolean(key && !selectedKeys.has(key));
    });
    const remainingUrls = selectRepresentativeUrls(
      remainingCandidates.map((candidate) => ({
        url: candidate.url,
        source: toDiscoverySource(candidate.source),
      })),
      limit - selected.length,
    );

    for (const url of remainingUrls) {
      const source = sourceByUrl.get(url) ?? "internal";
      add({
        url,
        source,
        reason: reasonForCandidate(url, source),
      });
    }

    return selected;
  }

  const seedKey = keyFor(input.seedUrl);
  if (seedKey && !selectedKeys.has(seedKey)) {
    add({
      url: input.seedUrl,
      source: "seed",
      reason: "seed",
    });
  }

  const structuralCandidates = [...candidateByKey.values()].filter((candidate) => {
    const key = keyFor(candidate.url);
    if (!key || selectedKeys.has(key) || classifyPagePath(candidate.url) === "utility") {
      return false;
    }

    return STRUCTURAL_PATH_CLASSES.has(classifyPagePath(candidate.url));
  });

  const rankedStructural = rankDiscoveredUrls(
    structuralCandidates.map((candidate) => ({
      url: candidate.url,
      source: toDiscoverySource(candidate.source),
    })),
  );

  let structuralCount = selected.filter((item) =>
    STRUCTURAL_PATH_CLASSES.has(classifyPagePath(item.url)),
  ).length;

  for (const item of rankedStructural) {
    if (structuralCount >= STRUCTURAL_RESERVE_SLOTS || selected.length >= limit) {
      break;
    }

    const pathClass = classifyPagePath(item.url);
    if (pathClass !== "homepage" && pathClass !== "identity" && pathClass !== "locale_home" && pathClass !== "category_service") {
      continue;
    }

    const source = candidateByKey.get(keyFor(item.url) ?? "")?.source ?? "internal";
    if (
      add({
        url: item.url,
        source,
        reason: STRUCTURAL_REASON_BY_CLASS[pathClass],
      })
    ) {
      structuralCount += 1;
    }
  }

  let gscCount = 0;
  for (const page of gscPages) {
    if (gscCount >= GSC_RESERVE_SLOTS || selected.length >= limit) {
      break;
    }

    if (
      add({
        url: page.url,
        source: "gsc_visibility",
        reason: "gsc_visibility",
      })
    ) {
      gscCount += 1;
    }
  }

  const leftoverCandidates: Array<{ url: string; source: DiscoverySource }> = [];
  const leftoverSeen = new Set<string>();

  for (const candidate of candidateByKey.values()) {
    const key = keyFor(candidate.url);
    if (!key || selectedKeys.has(key) || leftoverSeen.has(key)) {
      continue;
    }
    leftoverSeen.add(key);
    leftoverCandidates.push({
      url: candidate.url,
      source: toDiscoverySource(candidate.source),
    });
  }

  for (const page of gscPages) {
    const key = keyFor(page.url);
    if (!key || selectedKeys.has(key) || leftoverSeen.has(key)) {
      continue;
    }
    leftoverSeen.add(key);
    leftoverCandidates.push({
      url: page.url,
      source: "internal",
    });
  }

  const leftoverRanked = rankDiscoveredUrls(leftoverCandidates);
  const leftoverSourceByUrl = new Map(
    leftoverCandidates.map((candidate) => [candidate.url, candidate.source]),
  );
  const gscKeys = new Set(
    gscPages
      .map((page) => gscDedupeKey(page.url, origin))
      .filter((key): key is string => Boolean(key)),
  );

  for (const item of leftoverRanked) {
    if (selected.length >= limit) {
      break;
    }

    const inGsc = gscKeys.has(gscDedupeKey(item.url, origin) ?? "");
    if (classifyPagePath(item.url) === "utility") {
      continue;
    }
    if (inGsc && gscCount >= GSC_RESERVE_SLOTS) {
      continue;
    }

    const leftoverSource = leftoverSourceByUrl.get(item.url) ?? "internal";
    if (
      add({
        url: item.url,
        source: inGsc ? "gsc_visibility" : leftoverSource,
        reason: inGsc ? "priority_queue" : reasonForCandidate(item.url, leftoverSource),
      })
    ) {
      if (inGsc) {
        gscCount += 1;
      }
    }
  }

  return selected;
}

export function assignGscInformedQueuePriorities(input: {
  items: Array<{ id: string; url: string; status: string; priority: number }>;
  selected: SelectedCrawlUrl[];
  origin?: string;
  evidence?: PageHostEvidence[];
}): Array<{ id: string; priority: number }> {
  const evidence = input.evidence ?? [];
  const urlsInPlay = [
    ...input.items.map((item) => item.url),
    ...input.selected.map((item) => item.url),
  ];
  const keyFor = createSampleSelectionKey({
    urls: urlsInPlay,
    evidence,
    origin: input.origin,
  });
  const selectedByKey = new Map<string, SelectedCrawlUrl>();
  for (const item of input.selected) {
    const key = keyFor(item.url);
    if (key) {
      selectedByKey.set(key, item);
    }
  }

  const gscSelected = input.selected.filter((item) => item.reason === "gsc_visibility");
  const otherSelected = input.selected.filter((item) => item.reason !== "gsc_visibility");
  const gscIndex = new Map(gscSelected.map((item, index) => [keyFor(item.url), index]));
  const otherIndex = new Map(otherSelected.map((item, index) => [keyFor(item.url), index]));

  const updates: Array<{ id: string; priority: number }> = [];

  for (const item of input.items) {
    if (item.status !== "pending") {
      continue;
    }

    const key = keyFor(item.url);
    const selected = key ? selectedByKey.get(key) : undefined;
    if (!selected || !key) {
      if (item.priority !== UNSELECTED_QUEUE_PRIORITY) {
        updates.push({ id: item.id, priority: UNSELECTED_QUEUE_PRIORITY });
      }
      continue;
    }

    const sameSelectedUrl =
      normalizeCrawlUrl(item.url, input.origin) === normalizeCrawlUrl(selected.url, input.origin);
    if (
      !sameSelectedUrl &&
      classifyWwwApexRelation(item.url, selected.url, evidence, input.origin) === "equivalent"
    ) {
      if (item.priority !== UNSELECTED_QUEUE_PRIORITY) {
        updates.push({ id: item.id, priority: UNSELECTED_QUEUE_PRIORITY });
      }
      continue;
    }

    let nextPriority = SELECTED_FILLER_PRIORITY;
    if (selected.reason === "gsc_visibility") {
      nextPriority = GSC_QUEUE_PRIORITY - (gscIndex.get(key) ?? 0);
    } else if (selected.source === "seed" || selected.reason === "seed") {
      nextPriority = 100;
    } else if (
      selected.reason === "homepage" ||
      selected.reason === "identity" ||
      selected.reason === "locale_home" ||
      selected.reason === "category_service"
    ) {
      nextPriority = SELECTED_STRUCTURAL_PRIORITY - (otherIndex.get(key) ?? 0);
    }

    if (nextPriority !== item.priority) {
      updates.push({ id: item.id, priority: nextPriority });
    }
  }

  return updates;
}
