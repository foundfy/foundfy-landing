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
  | "google_not_connected"
  | "sync_google_performance"
  | "google_unavailable"
  | "indexing_not_checked"
  | "check_google_indexing"
  | "review_google_indexing";

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
  view: unknown | null;
  loadError: string | null;
};

export type GoogleIndexingUrlVerdict = "indexed" | "not_indexed" | "unknown";

export type GoogleIndexingUrlRole = "homepage" | "important_page";

export type GoogleIndexingUrlEvidence = {
  url: string;
  role: GoogleIndexingUrlRole;
  verdict: GoogleIndexingUrlVerdict;
  coverageState: string | null;
  indexingState: string | null;
  robotsTxtState: string | null;
  pageFetchState: string | null;
  lastCrawlTime: string | null;
  inspectedAt: string;
  userCanonical: string | null;
  googleCanonical: string | null;
  canonicalMismatch: boolean;
  referringUrls: string[];
  sitemaps: string[];
  reason: string | null;
};

export type GoogleSitemapObservationEntry = {
  path: string;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  pending: boolean;
  errors: number | null;
  warnings: number | null;
  submittedUrlCount: number | null;
};

export type GoogleSitemapObservation = {
  crawledSitemapUrls: string[];
  listedInSearchConsole: boolean;
  sitemaps: GoogleSitemapObservationEntry[];
  interpretation: "listed_and_processed" | "listed_pending_or_errors" | "none_listed";
};

export type GoogleIndexingEvidenceInput =
  | { kind: "not_checked" }
  | { kind: "no_session" }
  | { kind: "not_connected" }
  | { kind: "expired" }
  | { kind: "pilot_ineligible" }
  | { kind: "unavailable"; code?: "quota" | "unavailable" | "malformed" }
  | {
      kind: "checked";
      inspectedAt: string;
      reused: boolean;
      urls: GoogleIndexingUrlEvidence[];
      sitemap: GoogleSitemapObservation;
    };

export type StoredGoogleIndexingEvidence = {
  websiteId: string;
  evidence: GoogleIndexingEvidenceInput | null;
  loadError: string | null;
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
