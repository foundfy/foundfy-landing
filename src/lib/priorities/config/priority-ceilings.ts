import type { RuleKey } from "@/lib/observations/types";
import type { PriorityLevel } from "../types";

/**
 * Maximum effective priority level by rule key.
 * Rules omitted from this map are unrestricted.
 *
 * Ceilings prevent low-impact informational findings from ranking highly
 * purely because they affect a large share of a small crawl.
 */
export const RULE_PRIORITY_CEILINGS: Partial<Record<RuleKey, PriorityLevel>> = {
  "indexability.redirecting_url": "low",
  "page_fundamentals.title_length_out_of_range": "low",
  "page_fundamentals.multiple_h1": "medium",
  "page_fundamentals.duplicate_meta_description": "medium",
  "page_fundamentals.missing_meta_description": "medium",
  "internal_structure.zero_internal_links": "medium",
  "internal_structure.orphan_sitemap_page": "medium",
};

export function getPriorityCeiling(ruleKey: RuleKey): PriorityLevel | null {
  return RULE_PRIORITY_CEILINGS[ruleKey] ?? null;
}
