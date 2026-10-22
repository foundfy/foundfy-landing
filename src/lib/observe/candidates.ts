import { classifyPagePath } from "@/lib/crawler/select/page-priority";
import { extractUrlLocale } from "@/lib/crawler/parse/url-locale";
import { isSameSite, validatePublicHttpUrl } from "@/lib/crawler/url/normalize";
import { pageComparisonKey } from "@/lib/gsc/page-map";
import { normalizeHtmlLang } from "@/lib/research/languages";
import { rankObserveCandidates, type RankingGscRow, type RankingLink } from "./ranking";
import { persistedRobotsAllowsPath, type PersistedRobotsArtifact } from "./robots";
import type { ObserveCandidate } from "./types";
import type { ObservePageRow, ObserveQueueRow } from "./db";

export function isFetchedOrEquivalent(
  url: string,
  pages: ObservePageRow[],
): boolean {
  const key = pageComparisonKey(url);
  if (!key) {
    return true;
  }

  return pages.some((page) =>
    [page.requestedUrl, page.finalUrl, page.canonical].some(
      (value) => Boolean(value) && pageComparisonKey(value as string) === key,
    ),
  );
}

export function isLanguageEligible(url: string, ideaLanguage: string): boolean {
  const idea = normalizeHtmlLang(ideaLanguage);
  if (!idea) {
    return false;
  }

  const locale = extractUrlLocale(url);
  if (!locale) {
    return true;
  }

  return normalizeHtmlLang(locale) === idea;
}

export function robotsAllowsQueueUrl(
  url: string,
  artifact: PersistedRobotsArtifact | null,
): boolean {
  let pathname = "/";
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false;
  }
  return persistedRobotsAllowsPath(pathname, artifact);
}

export function selectObserveCandidates(input: {
  hostname: string;
  keyword: string;
  seedOffering: string;
  languageCode: string;
  queue: ObserveQueueRow[];
  pages: ObservePageRow[];
  links: RankingLink[];
  gscRows: RankingGscRow[];
  robots: PersistedRobotsArtifact | null;
}): ObserveCandidate[] {
  const eligible = input.queue.flatMap((item) => {
    if (item.status !== "pending" || item.skipReason != null) {
      return [];
    }
    if (isFetchedOrEquivalent(item.url, input.pages)) {
      return [];
    }
    const publicUrl = validatePublicHttpUrl(item.url);
    if (!publicUrl) {
      return [];
    }
    if (!isSameSite(item.url, input.hostname)) {
      return [];
    }
    if (!robotsAllowsQueueUrl(item.url, input.robots)) {
      return [];
    }
    if (!isLanguageEligible(item.url, input.languageCode)) {
      return [];
    }
    if (classifyPagePath(item.url) === "utility") {
      return [];
    }
    const urlKey = pageComparisonKey(item.url);
    if (!urlKey) {
      return [];
    }
    return [{ queueItemId: item.id, url: item.url, urlKey }];
  });

  return rankObserveCandidates({
    keyword: input.keyword,
    seedOffering: input.seedOffering,
    urls: eligible,
    links: input.links,
    gscRows: input.gscRows,
  }).map((row) => ({
    queueItemId: row.queueItemId,
    url: row.url,
    urlKey: row.urlKey,
    reasonCopy: row.reasonCopy,
    rankClass: row.rankClass,
    gscSupport: row.gscSupport,
  }));
}
