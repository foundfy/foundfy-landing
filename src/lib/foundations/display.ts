import { formatCompletedScopeCopy } from "@/lib/analysis/analysis-scope";
import {
  evaluateGooglePerformance,
  googleIndexingCheck,
  interpretFoundationNextStep,
} from "./evaluate";
import type {
  CrawlFoundationsAssessment,
  FoundationStatus,
  GooglePerformanceEvidenceInput,
  TechnicalFoundationsView,
} from "./types";

export const FOUNDATIONS_HEADING = "Your website’s SEO foundations";

export const FOUNDATIONS_INTRO =
  "Foundfy checked the latest scan of this site. This is not a Google ranking report.";

export const FOUNDATIONS_NO_SCAN_INTRO =
  "Foundfy does not have a usable scan for this site yet. This is not a Google ranking report.";

export const FOUNDATION_STATUS_LABELS: Record<FoundationStatus, string> = {
  verified: "Verified",
  needs_attention: "Needs attention",
  not_checked: "Not checked",
  data_unavailable: "Data unavailable",
};

export const FOUNDATION_CHECK_LABELS = {
  important_pages: "Important pages",
  crawlability: "Crawlability",
  indexability: "Indexability signals",
  sitemap: "Sitemap",
  google_performance: "What Google reports",
  google_indexing: "Google indexing",
} as const;

export function formatFoundationsSampleCopy(
  crawl: CrawlFoundationsAssessment | null,
): string | null {
  if (!crawl || !crawl.crawlRunId) {
    return null;
  }

  const scope = formatCompletedScopeCopy(crawl.pagesFetched);
  if (!crawl.sampleLimited) {
    return `${scope}. Absence of a finding is not proof the whole website is healthy.`;
  }

  return `${scope} out of ${crawl.discoveredUrlCount} discovered URLs. Foundfy’s crawl sample is limited, so this is not a full-site check.`;
}

export function buildTechnicalFoundationsView(
  crawl: CrawlFoundationsAssessment | null,
  google: GooglePerformanceEvidenceInput | null,
): TechnicalFoundationsView {
  const assessment = crawl;
  const performance = evaluateGooglePerformance(google);
  const indexing = googleIndexingCheck();
  const nextStep = interpretFoundationNextStep(assessment, google);

  if (!assessment || !assessment.crawlRunId) {
    return {
      heading: FOUNDATIONS_HEADING,
      intro: FOUNDATIONS_NO_SCAN_INTRO,
      sampleCopy: null,
      checks: [
        assessment?.checks.importantPages ?? {
          id: "important_pages",
          status: "data_unavailable",
          summary: "Foundfy does not have a usable scan sample for this site yet.",
        },
        assessment?.checks.crawlability ?? {
          id: "crawlability",
          status: "data_unavailable",
          summary: "Foundfy does not have crawlability evidence from a usable scan yet.",
        },
        assessment?.checks.indexability ?? {
          id: "indexability",
          status: "data_unavailable",
          summary: "Foundfy does not have indexability evidence from a usable scan yet.",
        },
        assessment?.checks.sitemap ?? {
          id: "sitemap",
          status: "data_unavailable",
          summary: "Foundfy does not have a sitemap from a usable scan yet.",
        },
        performance,
        indexing,
      ],
      sitemapUrlCount: 0,
      sitemapUrls: [],
      nextStep,
    };
  }

  return {
    heading: FOUNDATIONS_HEADING,
    intro: FOUNDATIONS_INTRO,
    sampleCopy: formatFoundationsSampleCopy(assessment),
    checks: [
      assessment.checks.importantPages,
      assessment.checks.crawlability,
      assessment.checks.indexability,
      assessment.checks.sitemap,
      performance,
      indexing,
    ],
    sitemapUrlCount: assessment.sitemapUrlCount,
    sitemapUrls: assessment.sitemapUrls,
    nextStep,
  };
}
