import type { StoredObservation } from "@/lib/observations/types";
import { normalizeComparisonUrl } from "./normalize-comparison-url";

const SITE_WIDE_RULES = new Set([
  "site_discovery.robots_txt_missing",
  "site_discovery.sitemap_missing",
]);

function resolvePageUrl(observation: StoredObservation): string | null {
  const { evidence, pageUrl } = observation;

  if (typeof evidence.finalUrl === "string" && evidence.finalUrl.trim()) {
    return normalizeComparisonUrl(evidence.finalUrl);
  }

  if (typeof evidence.requestedUrl === "string" && evidence.requestedUrl.trim()) {
    return normalizeComparisonUrl(evidence.requestedUrl);
  }

  return normalizeComparisonUrl(pageUrl);
}

export function buildComparisonKey(observation: StoredObservation): string {
  const { ruleKey, evidence, pageUrl } = observation;

  if (SITE_WIDE_RULES.has(ruleKey)) {
    return ruleKey;
  }

  if (ruleKey === "indexability.redirecting_url") {
    const requestedUrl =
      typeof evidence.requestedUrl === "string"
        ? normalizeComparisonUrl(evidence.requestedUrl)
        : normalizeComparisonUrl(pageUrl);
    return `${ruleKey}|requested|${requestedUrl ?? "unknown"}`;
  }

  if (ruleKey === "indexability.robots_blocked_url") {
    const queueUrl =
      typeof evidence.queueUrl === "string"
        ? normalizeComparisonUrl(evidence.queueUrl)
        : normalizeComparisonUrl(pageUrl);
    return `${ruleKey}|queue|${queueUrl ?? "unknown"}`;
  }

  if (ruleKey === "internal_structure.broken_internal_link") {
    const sourceUrl = normalizeComparisonUrl(pageUrl);
    const targetUrl =
      typeof evidence.linkToUrl === "string"
        ? normalizeComparisonUrl(evidence.linkToUrl)
        : null;
    return `${ruleKey}|link|${sourceUrl ?? "unknown"}→${targetUrl ?? "unknown"}`;
  }

  if (ruleKey === "site_discovery.sitemap_url_issue") {
    const sitemapUrl =
      typeof evidence.sitemapUrl === "string"
        ? normalizeComparisonUrl(evidence.sitemapUrl)
        : normalizeComparisonUrl(pageUrl);
    return `${ruleKey}|sitemap|${sitemapUrl ?? "unknown"}`;
  }

  return `${ruleKey}|page|${resolvePageUrl(observation) ?? "unknown"}`;
}
