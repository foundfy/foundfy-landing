import type { RuleKey } from "@/lib/observations/types";

/**
 * Deterministic impact defaults by rule key.
 * Impact = potential effect on search visibility or crawl/indexation.
 * Values are normalized 0–100 and independent of observation severity.
 */
export const IMPACT_SCORES: Record<RuleKey, number> = {
  "indexability.noindex": 95,
  "indexability.robots_blocked_url": 90,
  "indexability.non_200_page": 85,
  "indexability.canonical_points_elsewhere": 70,
  "indexability.canonical_missing": 65,
  "indexability.redirecting_url": 25,
  "page_fundamentals.missing_title": 75,
  "page_fundamentals.missing_meta_description": 50,
  "page_fundamentals.missing_h1": 55,
  "page_fundamentals.duplicate_title": 60,
  "page_fundamentals.duplicate_meta_description": 45,
  "page_fundamentals.multiple_h1": 35,
  "page_fundamentals.title_length_out_of_range": 20,
  "internal_structure.broken_internal_link": 70,
  "internal_structure.zero_internal_links": 45,
  "internal_structure.orphan_sitemap_page": 30,
  "site_discovery.robots_txt_missing": 80,
  "site_discovery.sitemap_missing": 75,
  "site_discovery.sitemap_url_issue": 65,
};

export function getImpactScore(ruleKey: RuleKey): number {
  return IMPACT_SCORES[ruleKey];
}
