import type { HomepageBlockKind } from "@/lib/analysis/search-presence";

export type FoundationStatus =
  | "verified"
  | "needs_attention"
  | "not_checked"
  | "data_unavailable";

export type FoundationCheckId =
  | "important_pages"
  | "crawlability"
  | "indexability"
  | "sitemap"
  | "google_performance"
  | "google_indexing";

export type FoundationCheck = {
  id: FoundationCheckId;
  status: FoundationStatus;
  summary: string;
  detail?: string;
};

export type FoundationNextStepCode =
  | "no_scan"
  | "review_homepage_block"
  | "review_fetch_error"
  | "review_indexability_block"
  | "review_sitemap_urls"
  | "wait_for_google_discovery"
  | "connect_google_for_performance"
  | "indexing_not_checked";

export type FoundationNextStep = {
  code: FoundationNextStepCode;
  message: string;
};

export type CrawlFoundationsAssessment = {
  crawlRunId: string | null;
  hostname: string | null;
  pagesFetched: number;
  discoveredUrlCount: number;
  sampleLimited: boolean;
  fetchedPageUrls: string[];
  sitemapUrlCount: number;
  sitemapUrls: string[];
  homepageBlock: HomepageBlockKind | null;
  hasImportantFetchError: boolean;
  hasImportantIndexabilityBlock: boolean;
  hasSitemapUrlIssues: boolean;
  checks: {
    importantPages: FoundationCheck;
    crawlability: FoundationCheck;
    indexability: FoundationCheck;
    sitemap: FoundationCheck;
  };
};

export type GooglePerformanceEvidenceInput =
  | { kind: "no_session" }
  | { kind: "not_connected" }
  | { kind: "not_synced" }
  | { kind: "unavailable" }
  | { kind: "empty"; windowDays: number }
  | { kind: "reported"; windowDays: number; queriesReported: number };

export type StoredGooglePerformanceEvidence = {
  websiteId: string;
  evidence: GooglePerformanceEvidenceInput | null;
};

export type TechnicalFoundationsView = {
  heading: string;
  intro: string;
  sampleCopy: string | null;
  checks: FoundationCheck[];
  sitemapUrlCount: number;
  sitemapUrls: string[];
  nextStep: FoundationNextStep;
};
