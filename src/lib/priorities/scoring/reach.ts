import type { RuleKey } from "@/lib/observations/types";
import type { StoredObservation } from "@/lib/observations/types";
import type { PriorityContext } from "../types";
import { clampScore } from "./formula";

export type ReachStrategy =
  | "site_wide"
  | "single_page"
  | "duplicate_group"
  | "broken_link_frequency";

export const REACH_STRATEGIES: Record<RuleKey, ReachStrategy> = {
  "indexability.non_200_page": "single_page",
  "indexability.robots_blocked_url": "single_page",
  "indexability.noindex": "single_page",
  "indexability.redirecting_url": "single_page",
  "indexability.canonical_missing": "single_page",
  "indexability.canonical_points_elsewhere": "single_page",
  "page_fundamentals.missing_title": "single_page",
  "page_fundamentals.duplicate_title": "duplicate_group",
  "page_fundamentals.title_length_out_of_range": "single_page",
  "page_fundamentals.missing_meta_description": "single_page",
  "page_fundamentals.duplicate_meta_description": "duplicate_group",
  "page_fundamentals.missing_h1": "single_page",
  "page_fundamentals.multiple_h1": "single_page",
  "internal_structure.zero_internal_links": "single_page",
  "internal_structure.broken_internal_link": "broken_link_frequency",
  "internal_structure.orphan_sitemap_page": "single_page",
  "site_discovery.robots_txt_missing": "site_wide",
  "site_discovery.sitemap_missing": "site_wide",
  "site_discovery.sitemap_url_issue": "single_page",
};

function ratioToReachScore(affectedPages: number, totalPages: number): number {
  if (totalPages <= 0) {
    return 0;
  }

  return clampScore((affectedPages / totalPages) * 100);
}

function getDuplicateGroupSize(observation: StoredObservation): number {
  const pageCount = observation.evidence.pageCount;
  if (typeof pageCount === "number" && pageCount > 0) {
    return pageCount;
  }

  const duplicatePages = observation.evidence.duplicatePages;
  if (Array.isArray(duplicatePages)) {
    return duplicatePages.length;
  }

  return 1;
}

function getBrokenLinkFrequency(
  observation: StoredObservation,
  context: PriorityContext,
): number {
  const linkToUrl = observation.evidence.linkToUrl;
  if (typeof linkToUrl !== "string") {
    return 1;
  }

  return context.brokenLinkTargetCounts.get(linkToUrl) ?? 1;
}

export function calculateReachScore(
  observation: StoredObservation,
  context: PriorityContext,
): { score: number; affectedPages: number; reason: string } {
  const strategy = REACH_STRATEGIES[observation.ruleKey];
  const totalPages = Math.max(context.totalPagesCrawled, 1);

  if (strategy === "site_wide") {
    return {
      score: 100,
      affectedPages: totalPages,
      reason: "Site-wide issue affecting the whole crawl scope.",
    };
  }

  if (strategy === "duplicate_group") {
    const affectedPages = getDuplicateGroupSize(observation);
    const score = ratioToReachScore(affectedPages, totalPages);
    return {
      score,
      affectedPages,
      reason: `Affects ${affectedPages} of ${totalPages} crawled pages.`,
    };
  }

  if (strategy === "broken_link_frequency") {
    const affectedPages = getBrokenLinkFrequency(observation, context);
    const score = ratioToReachScore(affectedPages, totalPages);
    return {
      score,
      affectedPages,
      reason: `Broken link target appears on ${affectedPages} crawled page link(s).`,
    };
  }

  const score = ratioToReachScore(1, totalPages);
  return {
    score,
    affectedPages: 1,
    reason: `Affects 1 of ${totalPages} crawled pages.`,
  };
}

export function buildBrokenLinkTargetCounts(
  observations: StoredObservation[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const observation of observations) {
    if (observation.ruleKey !== "internal_structure.broken_internal_link") {
      continue;
    }

    const linkToUrl = observation.evidence.linkToUrl;
    if (typeof linkToUrl !== "string") {
      continue;
    }

    counts.set(linkToUrl, (counts.get(linkToUrl) ?? 0) + 1);
  }

  return counts;
}
