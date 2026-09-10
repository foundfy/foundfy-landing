import type { StoredObservation } from "@/lib/observations/types";
import {
  isPageUrlCrawled,
  isRequestedUrlCrawled,
} from "./crawl-coverage";
import { normalizeComparisonUrl } from "./normalize-comparison-url";
import type { CrawlCoverage } from "./types";

const SITE_WIDE_RULES = new Set([
  "site_discovery.robots_txt_missing",
  "site_discovery.sitemap_missing",
]);

export function hasSufficientVerificationCoverage(
  observation: StoredObservation,
  coverage: CrawlCoverage,
): boolean {
  const { ruleKey, evidence, pageUrl } = observation;

  if (SITE_WIDE_RULES.has(ruleKey)) {
    return true;
  }

  if (ruleKey === "indexability.robots_blocked_url") {
    const queueUrl =
      typeof evidence.queueUrl === "string"
        ? normalizeComparisonUrl(evidence.queueUrl)
        : normalizeComparisonUrl(pageUrl);
    return queueUrl ? coverage.queuedUrls.has(queueUrl) : false;
  }

  if (ruleKey === "indexability.redirecting_url") {
    const requestedUrl =
      typeof evidence.requestedUrl === "string"
        ? normalizeComparisonUrl(evidence.requestedUrl)
        : normalizeComparisonUrl(pageUrl);
    return isRequestedUrlCrawled(requestedUrl, coverage);
  }

  if (ruleKey === "internal_structure.broken_internal_link") {
    const sourceUrl = normalizeComparisonUrl(pageUrl);
    if (!sourceUrl || !isPageUrlCrawled(sourceUrl, coverage)) {
      return false;
    }

    const targetUrl =
      typeof evidence.linkToUrl === "string"
        ? normalizeComparisonUrl(evidence.linkToUrl)
        : null;
    if (!targetUrl) {
      return false;
    }

    const outgoing = coverage.outgoingLinksBySource.get(sourceUrl);
    const stillHasLink = outgoing?.has(targetUrl) ?? false;

    if (!stillHasLink) {
      return true;
    }

    return coverage.targetStatusByUrl.has(targetUrl);
  }

  if (ruleKey === "site_discovery.sitemap_url_issue") {
    const sitemapUrl =
      typeof evidence.sitemapUrl === "string"
        ? normalizeComparisonUrl(evidence.sitemapUrl)
        : normalizeComparisonUrl(pageUrl);
    if (!sitemapUrl || !coverage.sitemapUrls.has(sitemapUrl)) {
      return false;
    }

    return (
      coverage.crawledPageUrls.has(sitemapUrl) ||
      coverage.queuedUrls.has(sitemapUrl)
    );
  }

  const resolvedPageUrl =
    typeof evidence.finalUrl === "string"
      ? normalizeComparisonUrl(evidence.finalUrl)
      : typeof evidence.requestedUrl === "string"
        ? normalizeComparisonUrl(evidence.requestedUrl)
        : normalizeComparisonUrl(pageUrl);

  return isPageUrlCrawled(resolvedPageUrl, coverage);
}
