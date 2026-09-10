import type { RuleKey } from "@/lib/observations/types";
import type { StoredObservation } from "@/lib/observations/types";

/**
 * Base confidence by rule. Observations are deterministic; confidence is reduced
 * only where evidence can be incomplete or ambiguous within Phase 1 scope.
 */
export const BASE_CONFIDENCE_SCORES: Record<RuleKey, number> = {
  "indexability.non_200_page": 100,
  "indexability.robots_blocked_url": 100,
  "indexability.noindex": 100,
  "indexability.redirecting_url": 100,
  "indexability.canonical_missing": 95,
  "indexability.canonical_points_elsewhere": 95,
  "page_fundamentals.missing_title": 100,
  "page_fundamentals.duplicate_title": 90,
  "page_fundamentals.title_length_out_of_range": 100,
  "page_fundamentals.missing_meta_description": 100,
  "page_fundamentals.duplicate_meta_description": 90,
  "page_fundamentals.missing_h1": 100,
  "page_fundamentals.multiple_h1": 100,
  "internal_structure.zero_internal_links": 100,
  "internal_structure.broken_internal_link": 100,
  "internal_structure.orphan_sitemap_page": 80,
  "site_discovery.robots_txt_missing": 100,
  "site_discovery.sitemap_missing": 100,
  "site_discovery.sitemap_url_issue": 95,
};

export function getConfidenceScore(observation: StoredObservation): number {
  const base = BASE_CONFIDENCE_SCORES[observation.ruleKey];

  if (observation.ruleKey === "internal_structure.broken_internal_link") {
    const statusCode = observation.evidence.targetStatusCode;
    if (typeof statusCode !== "number") {
      return 70;
    }
  }

  if (observation.ruleKey === "internal_structure.orphan_sitemap_page") {
    if (observation.evidence.evidenceScope === "sitemap_only") {
      return 80;
    }
  }

  return base;
}
