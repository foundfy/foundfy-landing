import { formatCompletedScopeCopy } from "@/lib/analysis/analysis-scope";
import {
  evaluateGooglePerformance,
  googleIndexingCheck,
  interpretFoundationNextStep,
} from "./evaluate";
import type {
  CrawlFoundationsAssessment,
  FoundationStatus,
  GoogleIndexingEvidenceInput,
  GoogleIndexingUrlEvidence,
  GooglePerformanceEvidenceInput,
  GoogleSitemapObservation,
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

export const GOOGLE_INDEXING_CHECK_LABEL = "Check Google indexing";
export const GOOGLE_INDEXING_CHECKING_LABEL = "Checking Google indexing…";
export const GOOGLE_INDEXING_CHECKED_LABEL = "Google indexing checked";
export const GOOGLE_INDEXING_CHECK_AGAIN_LABEL = "Check again";
export const GOOGLE_INDEXING_RETRY_LABEL = "Retry check";
export const GOOGLE_INDEXING_PREVIOUS_RESULTS_COPY =
  "The results below are from the previous check. They are not from this failed attempt.";

export const GOOGLE_INDEXING_VERDICT_LABELS = {
  indexed: "Indexed",
  not_indexed: "Not indexed",
  unknown: "Unknown / not checked",
} as const;

export type GoogleIndexingVerdictCounts = {
  indexed: number;
  notIndexed: number;
  unknown: number;
};

export type GoogleIndexingOwnerActionState =
  | "hidden"
  | "never_checked"
  | "checking"
  | "completed"
  | "error";

export type GoogleIndexingOwnerAction = {
  visible: boolean;
  label: string;
  disabled: boolean;
  emphasis: "primary" | "secondary";
  state: GoogleIndexingOwnerActionState;
};

export function countGoogleIndexingVerdicts(
  urls: Pick<GoogleIndexingUrlEvidence, "verdict">[],
): GoogleIndexingVerdictCounts {
  const counts: GoogleIndexingVerdictCounts = {
    indexed: 0,
    notIndexed: 0,
    unknown: 0,
  };

  for (const url of urls) {
    if (url.verdict === "indexed") {
      counts.indexed += 1;
    } else if (url.verdict === "not_indexed") {
      counts.notIndexed += 1;
    } else {
      counts.unknown += 1;
    }
  }

  return counts;
}

export function formatGoogleIndexingVerdictSummary(
  counts: GoogleIndexingVerdictCounts,
): string {
  const parts = [`Indexed: ${counts.indexed}`, `Not indexed: ${counts.notIndexed}`];
  if (counts.unknown > 0) {
    parts.push(`Unknown: ${counts.unknown}`);
  }
  return parts.join(" · ");
}

export function googleIndexingOwnerAction(input: {
  available: boolean;
  busy: boolean;
  evidence: GoogleIndexingEvidenceInput | null;
  loadError: string | null;
}): GoogleIndexingOwnerAction {
  if (!input.available) {
    return {
      visible: false,
      label: "",
      disabled: true,
      emphasis: "primary",
      state: "hidden",
    };
  }

  if (input.busy) {
    return {
      visible: true,
      label: GOOGLE_INDEXING_CHECKING_LABEL,
      disabled: true,
      emphasis: input.evidence?.kind === "checked" ? "secondary" : "primary",
      state: "checking",
    };
  }

  const failedAttempt =
    Boolean(input.loadError) ||
    input.evidence?.kind === "unavailable" ||
    input.evidence?.kind === "no_session" ||
    input.evidence?.kind === "expired" ||
    input.evidence?.kind === "not_connected";

  if (failedAttempt) {
    return {
      visible: true,
      label: GOOGLE_INDEXING_RETRY_LABEL,
      disabled: false,
      emphasis: "primary",
      state: "error",
    };
  }

  if (input.evidence?.kind === "checked") {
    return {
      visible: true,
      label: GOOGLE_INDEXING_CHECK_AGAIN_LABEL,
      disabled: false,
      emphasis: "secondary",
      state: "completed",
    };
  }

  return {
    visible: true,
    label: GOOGLE_INDEXING_CHECK_LABEL,
    disabled: false,
    emphasis: "primary",
    state: "never_checked",
  };
}

export function formatGoogleSitemapObservationCopy(sitemap: GoogleSitemapObservation): string {
  const crawledCount = sitemap.crawledSitemapUrls.length;
  const crawledCopy =
    crawledCount > 0
      ? ` Foundfy found ${crawledCount} sitemap${crawledCount === 1 ? "" : "s"} during the website crawl.`
      : " Foundfy did not persist a sitemap from the website crawl.";

  if (sitemap.interpretation === "none_listed") {
    return `No sitemap is listed in Search Console.${crawledCopy} Absence from submitted sitemaps does not prove Google cannot discover the site.`;
  }

  if (sitemap.interpretation === "listed_pending_or_errors") {
    return `Search Console listed a sitemap with pending processing or errors.${crawledCopy} Listing a sitemap is not proof that URLs are indexed.`;
  }

  return `Search Console listed a sitemap and does not currently report pending processing or errors.${crawledCopy} Listing and processing are not proof that URLs are indexed.`;
}

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
  indexingInput: GoogleIndexingEvidenceInput | null = null,
): TechnicalFoundationsView {
  const assessment = crawl;
  const performance = evaluateGooglePerformance(google);
  const indexing = googleIndexingCheck(indexingInput);
  const nextStep = interpretFoundationNextStep(assessment, google, indexingInput);

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
