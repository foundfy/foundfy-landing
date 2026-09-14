import type { PathClass } from "@/lib/crawler/select/page-priority";
import { formatDisplayPath } from "@/lib/recommendations/evidence";
import type { SiteModelRecord, SiteModelUnderstanding } from "./types";

export const PATH_CLASS_LABELS: Record<PathClass, string> = {
  homepage: "Homepage",
  identity: "About / identity URL",
  locale_home: "Locale home URL",
  category_service: "Category or service URL",
  product_content: "Product or content URL",
  other: "Other URL",
  utility: "Utility URL",
};

export type SiteUnderstandingPageView = {
  pageId: string;
  pathLabel: string;
  pathClassLabel: string;
  title: string | null;
  h1: string[];
  excerptPreview: string | null;
  htmlLang: string | null;
  urlLocale: string | null;
};

export type SiteUnderstandingView = {
  heading: string;
  statusLabel: string;
  sampleCopy: string;
  coverageCopy: string | null;
  pageTypeSummary: string;
  pages: SiteUnderstandingPageView[];
  languagesCopy: string;
  navigationCopy: string;
  structuredDataCopy: string;
  discoveryCopy: string;
  confirmationNote: string;
};

const EXCERPT_PREVIEW_CHARS = 220;

function previewExcerpt(excerpt: string | null): string | null {
  if (!excerpt) {
    return null;
  }

  if (excerpt.length <= EXCERPT_PREVIEW_CHARS) {
    return excerpt;
  }

  return `${excerpt.slice(0, EXCERPT_PREVIEW_CHARS).trimEnd()}…`;
}

export function formatSampleCopy(understanding: SiteModelUnderstanding): string {
  const { pagesCrawled, pagesDiscovered, maxPages } = understanding.sample;
  const pageWord = pagesCrawled === 1 ? "page" : "pages";

  if (understanding.sample.fetchedEveryDiscoveredHtmlPage) {
    return `Observed from the latest completed crawl of ${pagesCrawled} ${pageWord}. Foundfy fetched every HTML page it discovered in this crawl.`;
  }

  if (understanding.sample.sampleIsCapped) {
    return `Observed from the latest completed crawl of ${pagesCrawled} ${pageWord} (max ${maxPages}). Foundfy discovered ${pagesDiscovered} URLs and sampled a bounded set.`;
  }

  return `Observed from the latest completed crawl of ${pagesCrawled} ${pageWord}.`;
}

export function formatCoverageCopy(understanding: SiteModelUnderstanding): string | null {
  const notes: string[] = [];

  if (understanding.pages.length <= 2) {
    notes.push(
      "This sample is small. Foundfy is not inferring a full content catalog from these pages.",
    );
  }

  if (understanding.sample.pagesCrawled >= understanding.sample.maxPages) {
    notes.push("Foundfy stopped at the current 10-page crawl budget.");
  } else if (understanding.sample.sampleIsCapped) {
    notes.push("Some discovered URLs were not fetched in this crawl.");
  }

  return notes.length > 0 ? notes.join(" ") : null;
}

export function formatPageTypeSummary(understanding: SiteModelUnderstanding): string {
  if (understanding.pageTypeCounts.length === 0) {
    return "No fetched pages to classify.";
  }

  return understanding.pageTypeCounts
    .map((item) => `${PATH_CLASS_LABELS[item.pathClass]} (${item.count})`)
    .join(" · ");
}

export function formatLanguagesCopy(understanding: SiteModelUnderstanding): string {
  const langs = understanding.languages.htmlLangs;
  const locales = understanding.languages.urlLocales;

  if (langs.length === 0 && locales.length === 0) {
    return "No html lang or URL locale was stored on the fetched pages.";
  }

  const parts: string[] = [];
  if (langs.length > 0) {
    parts.push(`html lang: ${langs.join(", ")}`);
  }
  if (locales.length > 0) {
    parts.push(`URL locale: ${locales.join(", ")}`);
  } else {
    parts.push("No URL locale segment was observed.");
  }

  return parts.join(". ");
}

export function formatNavigationCopy(understanding: SiteModelUnderstanding): string {
  if (understanding.navigationLabels.length === 0) {
    return "No navigation labels were extracted from the fetched pages.";
  }

  return understanding.navigationLabels.join(" · ");
}

export function formatStructuredDataCopy(understanding: SiteModelUnderstanding): string {
  if (understanding.jsonLdTypes.length === 0 && understanding.jsonLdPropertyCount === 0) {
    return "No JSON-LD types or properties were stored. Foundfy is not inferring products, offers, or organization details.";
  }

  const types =
    understanding.jsonLdTypes.length > 0
      ? `JSON-LD types: ${understanding.jsonLdTypes.join(", ")}`
      : "No JSON-LD types stored.";
  return `${types}. Stored property records: ${understanding.jsonLdPropertyCount}.`;
}

export function formatDiscoveryCopy(understanding: SiteModelUnderstanding): string {
  const robots = understanding.siteDiscovery.robots;
  const robotsCopy = robots
    ? `robots.txt ${robots.statusCode ?? "unknown"} (${robots.url})`
    : "robots.txt was not saved for this crawl.";
  const sitemaps = understanding.siteDiscovery.sitemaps;
  const sitemapCopy =
    sitemaps.length === 0
      ? "No sitemap was saved for this crawl."
      : `Sitemap: ${sitemaps
          .map((item) => `${item.url} (${item.statusCode ?? "unknown"})`)
          .join("; ")}`;

  return `${robotsCopy} ${sitemapCopy}`;
}

export function buildSiteUnderstandingView(model: SiteModelRecord): SiteUnderstandingView {
  const { understanding } = model;

  return {
    heading: "This is how Foundfy currently understands this site",
    statusLabel: "Observed from crawl · not confirmed",
    sampleCopy: formatSampleCopy(understanding),
    coverageCopy: formatCoverageCopy(understanding),
    pageTypeSummary: formatPageTypeSummary(understanding),
    pages: understanding.pages.map((page) => ({
      pageId: page.pageId,
      pathLabel: formatDisplayPath(page.requestedUrl) ?? page.requestedUrl,
      pathClassLabel: PATH_CLASS_LABELS[page.pathClass],
      title: page.title,
      h1: page.h1,
      excerptPreview: previewExcerpt(page.excerpt),
      htmlLang: page.htmlLang,
      urlLocale: page.urlLocale,
    })),
    languagesCopy: formatLanguagesCopy(understanding),
    navigationCopy: formatNavigationCopy(understanding),
    structuredDataCopy: formatStructuredDataCopy(understanding),
    discoveryCopy: formatDiscoveryCopy(understanding),
    confirmationNote:
      "This is observed evidence from the crawl sample, not a confirmed description of the business, and not a list of tasks.",
  };
}
