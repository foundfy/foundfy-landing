import { pageComparisonKey } from "@/lib/gsc/page-map";
import { opportunityCompactKey, opportunityQueryKey } from "@/lib/opportunities/normalize";
import {
  OBSERVE_REASON_ANCHOR,
  OBSERVE_REASON_EXACT_PHRASE,
  OBSERVE_REASON_EXACT_WORDS,
  OBSERVE_REASON_SEED_OFFERING,
} from "./display";
import type { ObserveCandidateRankClass } from "./types";

const MAX_CANDIDATES = 5;

export type RankingLink = {
  toUrl: string;
  anchorText: string | null;
};

export type RankingGscRow = {
  pageUrl: string | null;
  queryText: string | null;
};

function pathHaystack(url: string): string {
  try {
    return opportunityQueryKey(new URL(url).pathname.replace(/[/-]+/g, " "));
  } catch {
    return "";
  }
}

function pathTokens(url: string): Set<string> {
  try {
    const tokens = new URL(url).pathname
      .split("/")
      .filter(Boolean)
      .flatMap((segment) => opportunityQueryKey(segment).split(" ").filter(Boolean));
    return new Set(tokens);
  } catch {
    return new Set();
  }
}

function pathCompact(url: string): string {
  try {
    return opportunityCompactKey(new URL(url).pathname);
  } catch {
    return "";
  }
}

function allTokensPresent(tokens: string[], hayTokens: Set<string>): boolean {
  return tokens.length > 0 && tokens.every((token) => hayTokens.has(token));
}

function phraseInPath(url: string, phrase: string): boolean {
  return Boolean(phrase) && pathHaystack(url).includes(phrase);
}

function compactInPath(url: string, compact: string): boolean {
  return Boolean(compact) && pathCompact(url).includes(compact);
}

function rankClassForUrl(input: {
  url: string;
  keyword: string;
  seedOffering: string;
  hasAnchor: boolean;
}): ObserveCandidateRankClass | null {
  const phrase = opportunityQueryKey(input.keyword);
  const compact = opportunityCompactKey(input.keyword);
  const tokens = phrase.split(" ").filter(Boolean);
  const hayTokens = pathTokens(input.url);

  if (phraseInPath(input.url, phrase)) {
    return "exact_phrase";
  }
  if (compactInPath(input.url, compact)) {
    return "exact_compact";
  }
  if (allTokensPresent(tokens, hayTokens)) {
    return "exact_tokens";
  }

  const offeringPhrase = opportunityQueryKey(input.seedOffering);
  const offeringTokens = offeringPhrase.split(" ").filter(Boolean);
  if (
    phraseInPath(input.url, offeringPhrase) ||
    allTokensPresent(offeringTokens, hayTokens)
  ) {
    return "seed_offering";
  }

  if (input.hasAnchor) {
    return "incoming_anchor";
  }

  return null;
}

function reasonCopy(rankClass: ObserveCandidateRankClass): string {
  switch (rankClass) {
    case "exact_phrase":
      return OBSERVE_REASON_EXACT_PHRASE;
    case "exact_compact":
    case "exact_tokens":
      return OBSERVE_REASON_EXACT_WORDS;
    case "seed_offering":
      return OBSERVE_REASON_SEED_OFFERING;
    case "incoming_anchor":
      return OBSERVE_REASON_ANCHOR;
  }
}

function classRank(rankClass: ObserveCandidateRankClass): number {
  switch (rankClass) {
    case "exact_phrase":
      return 1;
    case "exact_compact":
      return 2;
    case "exact_tokens":
      return 3;
    case "seed_offering":
      return 4;
    case "incoming_anchor":
      return 5;
  }
}

function pathnameLength(url: string): number {
  try {
    return new URL(url).pathname.length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function hasExactAnchor(input: {
  urlKey: string;
  keyword: string;
  links: RankingLink[];
}): boolean {
  const phrase = opportunityQueryKey(input.keyword);
  const compact = opportunityCompactKey(input.keyword);
  return input.links.some((link) => {
    if (pageComparisonKey(link.toUrl) !== input.urlKey) {
      return false;
    }
    const hay = opportunityQueryKey(link.anchorText ?? "");
    if (!hay) {
      return false;
    }
    return hay.includes(phrase) || opportunityCompactKey(hay) === compact;
  });
}

export function hasExactGscSupport(input: {
  urlKey: string;
  keyword: string;
  gscRows: RankingGscRow[];
}): boolean {
  const phrase = opportunityQueryKey(input.keyword);
  const compact = opportunityCompactKey(input.keyword);
  return input.gscRows.some((row) => {
    if (!row.pageUrl || !row.queryText) {
      return false;
    }
    if (pageComparisonKey(row.pageUrl) !== input.urlKey) {
      return false;
    }
    const query = opportunityQueryKey(row.queryText);
    return query === phrase || opportunityCompactKey(query) === compact;
  });
}

export function rankObserveCandidates(input: {
  keyword: string;
  seedOffering: string;
  urls: Array<{ queueItemId: string; url: string; urlKey: string }>;
  links: RankingLink[];
  gscRows: RankingGscRow[];
}): Array<{
  queueItemId: string;
  url: string;
  urlKey: string;
  rankClass: ObserveCandidateRankClass;
  reasonCopy: string;
  gscSupport: boolean;
}> {
  const ranked = input.urls.flatMap((item) => {
    const hasAnchor = hasExactAnchor({
      urlKey: item.urlKey,
      keyword: input.keyword,
      links: input.links,
    });
    const rankClass = rankClassForUrl({
      url: item.url,
      keyword: input.keyword,
      seedOffering: input.seedOffering,
      hasAnchor,
    });
    if (!rankClass) {
      return [];
    }

    return [
      {
        ...item,
        rankClass,
        reasonCopy: reasonCopy(rankClass),
        gscSupport: hasExactGscSupport({
          urlKey: item.urlKey,
          keyword: input.keyword,
          gscRows: input.gscRows,
        }),
      },
    ];
  });

  ranked.sort((left, right) => {
    const classDelta = classRank(left.rankClass) - classRank(right.rankClass);
    if (classDelta !== 0) {
      return classDelta;
    }
    if (left.gscSupport !== right.gscSupport) {
      return left.gscSupport ? -1 : 1;
    }
    const pathDelta = pathnameLength(left.url) - pathnameLength(right.url);
    if (pathDelta !== 0) {
      return pathDelta;
    }
    const keyDelta = left.urlKey.localeCompare(right.urlKey);
    if (keyDelta !== 0) {
      return keyDelta;
    }
    return left.queueItemId.localeCompare(right.queueItemId);
  });

  return ranked.slice(0, MAX_CANDIDATES);
}
