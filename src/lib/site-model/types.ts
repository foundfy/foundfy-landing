import type { JsonLdPropertySnippet } from "@/lib/crawler/types";
import type { PathClass } from "@/lib/crawler/select/page-priority";

export const SITE_MODEL_ROW_VERSION = 1;
export const SITE_MODEL_DERIVATION_VERSION = 1;

export type SiteModelStatus = "draft" | "confirmed" | "stale";

export const PATH_CLASS_ORDER: PathClass[] = [
  "homepage",
  "identity",
  "locale_home",
  "category_service",
  "product_content",
  "other",
  "utility",
];

export type SiteModelPageRecord = {
  pageId: string;
  requestedUrl: string;
  finalUrl: string;
  pathClass: PathClass;
  statusCode: number | null;
  title: string | null;
  h1: string[];
  h2: string[];
  h3: string[];
  excerpt: string | null;
  htmlLang: string | null;
  urlLocale: string | null;
  navLabels: string[];
  jsonLdTypes: string[];
  jsonLdProperties: JsonLdPropertySnippet[];
  wordCount: number;
  contentHash: string | null;
};

export type SiteModelPageTypeCount = {
  pathClass: PathClass;
  count: number;
};

export type SiteModelArtifactRecord = {
  artifactId: string;
  artifactType: "robots_txt" | "sitemap_xml";
  url: string;
  statusCode: number | null;
};

export type SiteModelUnderstanding = {
  derivationVersion: number;
  hostname: string;
  seedUrl: string;
  sample: {
    pagesCrawled: number;
    pagesDiscovered: number;
    maxPages: number;
    fetchedHttp200Count: number;
    sampleIsCapped: boolean;
    fetchedEveryDiscoveredHtmlPage: boolean;
  };
  pageTypeCounts: SiteModelPageTypeCount[];
  pages: SiteModelPageRecord[];
  languages: {
    htmlLangs: string[];
    urlLocales: string[];
  };
  navigationLabels: string[];
  jsonLdTypes: string[];
  jsonLdPropertyCount: number;
  siteDiscovery: {
    robots: SiteModelArtifactRecord | null;
    sitemaps: SiteModelArtifactRecord[];
  };
};

export type SiteModelEvidence = {
  source: "crawl";
  websiteId: string;
  crawlRunId: string;
  pageIds: string[];
  artifactIds: string[];
  fields: string[];
};

export type SiteModelRecord = {
  id: string;
  websiteId: string;
  sourceCrawlRunId: string;
  version: number;
  status: SiteModelStatus;
  understanding: SiteModelUnderstanding;
  interpretation: Record<string, unknown> | null;
  confirmed: Record<string, unknown> | null;
  evidence: SiteModelEvidence;
  derivedAt: string;
};

export type SiteModelPageInput = {
  id: string;
  requestedUrl: string;
  finalUrl: string;
  statusCode: number | null;
  title: string | null;
  h1: string[] | null;
  h2: string[] | null;
  h3: string[] | null;
  htmlLang: string | null;
  urlLocale: string | null;
  navLabels: string[] | null;
  mainExcerpt: string | null;
  contentHash: string | null;
  jsonLdTypes: string[] | null;
  jsonLdProperties: JsonLdPropertySnippet[] | null;
  wordCount: number | null;
  fetchedAt: string | null;
};

export type SiteModelArtifactInput = {
  id: string;
  artifactType: "robots_txt" | "sitemap_xml";
  url: string;
  statusCode: number | null;
};

export type SiteModelCrawlInput = {
  id: string;
  websiteId: string;
  hostname: string;
  seedUrl: string;
  pagesCrawled: number;
  pagesDiscovered: number;
  maxPages: number;
};

export const SITE_MODEL_EVIDENCE_FIELDS = [
  "pathClass",
  "title",
  "h1",
  "h2",
  "h3",
  "mainExcerpt",
  "navLabels",
  "jsonLdTypes",
  "jsonLdProperties",
  "htmlLang",
  "urlLocale",
  "contentHash",
  "robots",
  "sitemap",
] as const;
