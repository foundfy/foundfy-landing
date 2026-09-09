export type CrawlRunStatus = "queued" | "running" | "completed" | "failed";

export type QueueItemStatus =
  | "pending"
  | "processing"
  | "done"
  | "skipped"
  | "failed";

export type LinkType = "internal" | "external";

export type SiteArtifactType = "robots_txt" | "sitemap_xml";

export type RedirectHop = {
  url: string;
  statusCode: number;
};

export type FetchResult = {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  redirectChain: RedirectHop[];
  headers: Record<string, string>;
  body: string;
};

export type ParsedPage = {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  redirectChain: RedirectHop[];
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  xRobotsTag: string | null;
  h1: string[];
  h2: string[];
  htmlLang: string | null;
  internalLinks: Array<{ url: string; anchorText: string | null }>;
  externalLinks: Array<{ url: string; anchorText: string | null }>;
  imageCount: number;
  missingAltCount: number;
  jsonLdTypes: string[];
  wordCount: number;
};

export type RobotsRules = {
  sitemaps: string[];
  disallow: string[];
  allow: string[];
};

export type CrawlRunSummary = {
  id: string;
  status: CrawlRunStatus;
  hostname: string;
  seedUrl: string;
  maxPages: number;
  pagesCrawled: number;
  pagesDiscovered: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export const MAX_PAGES_PER_CRAWL = 10;
export const MAX_REDIRECTS = 5;
export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
