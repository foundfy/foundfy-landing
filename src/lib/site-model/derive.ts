import { classifyPagePath, type PathClass } from "@/lib/crawler/select/page-priority";
import type { JsonLdPropertySnippet } from "@/lib/crawler/types";
import {
  PATH_CLASS_ORDER,
  SITE_MODEL_DERIVATION_VERSION,
  SITE_MODEL_EVIDENCE_FIELDS,
  type SiteModelArtifactInput,
  type SiteModelCrawlInput,
  type SiteModelEvidence,
  type SiteModelPageInput,
  type SiteModelPageRecord,
  type SiteModelPageTypeCount,
  type SiteModelUnderstanding,
} from "./types";

const MAX_NAV_LABELS = 30;

function asStringArray(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function uniquePreserveOrder(values: string[], cap?: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);

    if (cap !== undefined && result.length >= cap) {
      break;
    }
  }

  return result;
}

function jsonLdPropertiesOf(
  value: JsonLdPropertySnippet[] | null | undefined,
): JsonLdPropertySnippet[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is JsonLdPropertySnippet =>
      Boolean(item) && typeof item === "object" && typeof item.type === "string",
  );
}

function toPageRecord(page: SiteModelPageInput): SiteModelPageRecord {
  return {
    pageId: page.id,
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    pathClass: classifyPagePath(page.requestedUrl),
    statusCode: page.statusCode,
    title: page.title,
    h1: asStringArray(page.h1),
    h2: asStringArray(page.h2),
    h3: asStringArray(page.h3),
    excerpt: page.mainExcerpt,
    htmlLang: page.htmlLang,
    urlLocale: page.urlLocale,
    navLabels: asStringArray(page.navLabels),
    jsonLdTypes: asStringArray(page.jsonLdTypes),
    jsonLdProperties: jsonLdPropertiesOf(page.jsonLdProperties),
    wordCount: page.wordCount ?? 0,
    contentHash: page.contentHash,
  };
}

function countPageTypes(pages: SiteModelPageRecord[]): SiteModelPageTypeCount[] {
  const counts = new Map<PathClass, number>();

  for (const page of pages) {
    counts.set(page.pathClass, (counts.get(page.pathClass) ?? 0) + 1);
  }

  return PATH_CLASS_ORDER.filter((pathClass) => (counts.get(pathClass) ?? 0) > 0).map(
    (pathClass) => ({
      pathClass,
      count: counts.get(pathClass) ?? 0,
    }),
  );
}

export function deriveSiteModelUnderstanding(input: {
  crawl: SiteModelCrawlInput;
  pages: SiteModelPageInput[];
  artifacts: SiteModelArtifactInput[];
}): SiteModelUnderstanding {
  const pages = [...input.pages]
    .sort((left, right) => {
      const leftTime = left.fetchedAt ?? "";
      const rightTime = right.fetchedAt ?? "";
      if (leftTime !== rightTime) {
        return leftTime.localeCompare(rightTime);
      }

      return left.requestedUrl.localeCompare(right.requestedUrl);
    })
    .map(toPageRecord);

  const fetchedHttp200Count = pages.filter((page) => page.statusCode === 200).length;
  const pagesCrawled = input.crawl.pagesCrawled;
  const pagesDiscovered = input.crawl.pagesDiscovered;
  const sampleIsCapped =
    pagesDiscovered > pagesCrawled || pagesCrawled >= input.crawl.maxPages;

  const robots =
    input.artifacts.find((artifact) => artifact.artifactType === "robots_txt") ?? null;
  const sitemaps = input.artifacts.filter(
    (artifact) => artifact.artifactType === "sitemap_xml",
  );

  const jsonLdProperties = pages.flatMap((page) => page.jsonLdProperties);

  return {
    derivationVersion: SITE_MODEL_DERIVATION_VERSION,
    hostname: input.crawl.hostname,
    seedUrl: input.crawl.seedUrl,
    sample: {
      pagesCrawled,
      pagesDiscovered,
      maxPages: input.crawl.maxPages,
      fetchedHttp200Count,
      sampleIsCapped,
      fetchedEveryDiscoveredHtmlPage:
        pagesDiscovered > 0 && pagesCrawled >= pagesDiscovered && pagesCrawled < input.crawl.maxPages,
    },
    pageTypeCounts: countPageTypes(pages),
    pages,
    languages: {
      htmlLangs: uniquePreserveOrder(
        pages
          .map((page) => page.htmlLang)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
      urlLocales: uniquePreserveOrder(
        pages
          .map((page) => page.urlLocale)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    },
    navigationLabels: uniquePreserveOrder(
      pages.flatMap((page) => page.navLabels),
      MAX_NAV_LABELS,
    ),
    jsonLdTypes: uniquePreserveOrder(pages.flatMap((page) => page.jsonLdTypes)),
    jsonLdPropertyCount: jsonLdProperties.length,
    siteDiscovery: {
      robots: robots
        ? {
            artifactId: robots.id,
            artifactType: "robots_txt",
            url: robots.url,
            statusCode: robots.statusCode,
          }
        : null,
      sitemaps: sitemaps.map((artifact) => ({
        artifactId: artifact.id,
        artifactType: "sitemap_xml" as const,
        url: artifact.url,
        statusCode: artifact.statusCode,
      })),
    },
  };
}

export function buildSiteModelEvidence(input: {
  websiteId: string;
  crawlRunId: string;
  pages: SiteModelPageInput[];
  artifacts: SiteModelArtifactInput[];
}): SiteModelEvidence {
  return {
    source: "crawl",
    websiteId: input.websiteId,
    crawlRunId: input.crawlRunId,
    pageIds: input.pages.map((page) => page.id),
    artifactIds: input.artifacts.map((artifact) => artifact.id),
    fields: [...SITE_MODEL_EVIDENCE_FIELDS],
  };
}
