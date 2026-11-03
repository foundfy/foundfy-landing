import type {
  GoogleIndexingUrlEvidence,
  GoogleIndexingUrlRole,
  GoogleIndexingUrlVerdict,
  GoogleSitemapObservation,
  GoogleSitemapObservationEntry,
} from "@/lib/foundations/types";
import { pageComparisonKey } from "./page-map";

export type GoogleIndexStatusFields = {
  verdict?: string;
  coverageState?: string;
  indexingState?: string;
  robotsTxtState?: string;
  pageFetchState?: string;
  lastCrawlTime?: string;
  userCanonical?: string;
  googleCanonical?: string;
  sitemap?: string[];
  referringUrls?: string[];
};

export type GoogleSitemapListEntry = {
  path?: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  errors?: number;
  warnings?: number;
  contents?: Array<{ type?: string; submitted?: number; indexed?: number }>;
};

function asString(value: string | undefined): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asStringList(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export function interpretIndexVerdict(status: GoogleIndexStatusFields): GoogleIndexingUrlVerdict {
  const verdict = (status.verdict ?? "").toUpperCase();

  // IndexStatusInspectionResult.verdict is the documented high-level indexed-status
  // result. PASS is Valid, NEUTRAL is Excluded. PARTIAL is reserved and unused.
  // FAIL is Error/Invalid, which is not conclusive Indexed or Not indexed evidence.
  if (verdict === "PASS") {
    return "indexed";
  }

  if (verdict === "NEUTRAL") {
    return "not_indexed";
  }

  return "unknown";
}

export function canonicalMismatch(
  userCanonical: string | null,
  googleCanonical: string | null,
): boolean {
  if (!userCanonical || !googleCanonical) {
    return false;
  }

  const userKey = pageComparisonKey(userCanonical);
  const googleKey = pageComparisonKey(googleCanonical);
  if (!userKey || !googleKey) {
    return userCanonical !== googleCanonical;
  }

  return userKey !== googleKey;
}

export function interpretIndexingReason(
  verdict: GoogleIndexingUrlVerdict,
  status: GoogleIndexStatusFields,
): string | null {
  const coverage = asString(status.coverageState);
  if (coverage) {
    return coverage;
  }

  if (verdict === "unknown") {
    return "Google did not clearly report whether this URL is indexed.";
  }

  return null;
}

export function interpretIndexStatus(input: {
  url: string;
  role: GoogleIndexingUrlRole;
  inspectedAt: string;
  status: GoogleIndexStatusFields | null | undefined;
}): GoogleIndexingUrlEvidence {
  const status = input.status ?? {};
  const verdict = interpretIndexVerdict(status);
  const userCanonical = asString(status.userCanonical);
  const googleCanonical = asString(status.googleCanonical);

  return {
    url: input.url,
    role: input.role,
    verdict,
    coverageState: asString(status.coverageState),
    indexingState: asString(status.indexingState),
    robotsTxtState: asString(status.robotsTxtState),
    pageFetchState: asString(status.pageFetchState),
    lastCrawlTime: asString(status.lastCrawlTime),
    inspectedAt: input.inspectedAt,
    userCanonical,
    googleCanonical,
    canonicalMismatch: canonicalMismatch(userCanonical, googleCanonical),
    referringUrls: asStringList(status.referringUrls),
    sitemaps: asStringList(status.sitemap),
    reason: interpretIndexingReason(verdict, status),
  };
}

function sitemapEntry(raw: GoogleSitemapListEntry): GoogleSitemapObservationEntry | null {
  const path = asString(raw.path);
  if (!path) {
    return null;
  }

  const webContent = Array.isArray(raw.contents)
    ? raw.contents.find((entry) => entry && (entry.type === "web" || entry.submitted != null))
    : null;

  return {
    path,
    lastSubmitted: asString(raw.lastSubmitted),
    lastDownloaded: asString(raw.lastDownloaded),
    pending: Boolean(raw.isPending),
    errors: typeof raw.errors === "number" && Number.isFinite(raw.errors) ? raw.errors : null,
    warnings: typeof raw.warnings === "number" && Number.isFinite(raw.warnings) ? raw.warnings : null,
    submittedUrlCount:
      typeof webContent?.submitted === "number" && Number.isFinite(webContent.submitted)
        ? webContent.submitted
        : null,
  };
}

export function interpretSitemapsList(input: {
  sitemaps: GoogleSitemapListEntry[] | null | undefined;
  crawledSitemapUrls: string[];
}): GoogleSitemapObservation {
  const sitemaps = (input.sitemaps ?? [])
    .map(sitemapEntry)
    .filter((entry): entry is GoogleSitemapObservationEntry => entry != null);

  const listedInSearchConsole = sitemaps.length > 0;
  const hasPendingOrErrors = sitemaps.some(
    (entry) => entry.pending || (entry.errors != null && entry.errors > 0),
  );

  return {
    crawledSitemapUrls: input.crawledSitemapUrls,
    listedInSearchConsole,
    sitemaps,
    interpretation: !listedInSearchConsole
      ? "none_listed"
      : hasPendingOrErrors
        ? "listed_pending_or_errors"
        : "listed_and_processed",
  };
}
