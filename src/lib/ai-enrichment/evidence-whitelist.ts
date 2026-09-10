import type { RuleKey } from "@/lib/observations/types";

export const RULE_EVIDENCE_WHITELIST: Record<RuleKey, readonly string[]> = {
  "indexability.non_200_page": [
    "requestedUrl",
    "finalUrl",
    "statusCode",
  ],
  "indexability.robots_blocked_url": [
    "queueUrl",
    "queueStatus",
    "skipReason",
  ],
  "indexability.noindex": [
    "requestedUrl",
    "finalUrl",
    "robotsMeta",
    "xRobotsTag",
  ],
  "indexability.redirecting_url": [
    "requestedUrl",
    "finalUrl",
    "redirectChain",
  ],
  "indexability.canonical_missing": [
    "requestedUrl",
    "finalUrl",
    "canonical",
  ],
  "indexability.canonical_points_elsewhere": [
    "requestedUrl",
    "finalUrl",
    "canonical",
  ],
  "page_fundamentals.missing_title": ["requestedUrl", "finalUrl"],
  "page_fundamentals.duplicate_title": [
    "requestedUrl",
    "finalUrl",
    "title",
    "pageCount",
    "duplicatePages",
  ],
  "page_fundamentals.title_length_out_of_range": [
    "requestedUrl",
    "finalUrl",
    "title",
    "titleLength",
  ],
  "page_fundamentals.missing_meta_description": ["requestedUrl", "finalUrl"],
  "page_fundamentals.duplicate_meta_description": [
    "requestedUrl",
    "finalUrl",
    "metaDescription",
    "pageCount",
    "duplicatePages",
  ],
  "page_fundamentals.missing_h1": ["requestedUrl", "finalUrl"],
  "page_fundamentals.multiple_h1": [
    "requestedUrl",
    "finalUrl",
    "h1",
    "h1Count",
  ],
  "internal_structure.zero_internal_links": [
    "requestedUrl",
    "finalUrl",
    "internalLinkCount",
  ],
  "internal_structure.broken_internal_link": [
    "linkFromUrl",
    "linkToUrl",
    "targetStatusCode",
    "anchorText",
  ],
  "internal_structure.orphan_sitemap_page": [
    "requestedUrl",
    "finalUrl",
    "evidenceScope",
  ],
  "site_discovery.robots_txt_missing": ["artifactUrl", "artifactStatusCode"],
  "site_discovery.sitemap_missing": ["artifactUrl", "artifactStatusCode"],
  "site_discovery.sitemap_url_issue": [
    "sitemapUrl",
    "statusCode",
    "issueType",
  ],
};

export function pickWhitelistedEvidence(
  ruleKey: RuleKey,
  evidence: Record<string, unknown>,
): Record<string, unknown> {
  const allowedKeys = RULE_EVIDENCE_WHITELIST[ruleKey];
  const picked: Record<string, unknown> = {};

  for (const key of allowedKeys) {
    if (key in evidence) {
      picked[key] = evidence[key];
    }
  }

  return picked;
}
