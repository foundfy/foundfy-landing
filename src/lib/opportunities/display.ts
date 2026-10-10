import { SEARCH_ANALYTICS_WINDOW_DAYS } from "@/lib/gsc/config";
import type { QueryOpportunityCard } from "./types";

export const OPPORTUNITY_SECTION_HEADING = "Search demand to review";
export const OPPORTUNITY_SECTION_COPY =
  "These are searches where Google already showed your website. Foundfy is showing current search evidence, not predicting future traffic.";
export const OPPORTUNITY_CARD_COPY = `Your website appeared for this search during the current ${SEARCH_ANALYTICS_WINDOW_DAYS}-day Google Search period. This is the leading page Foundfy sees for the search.`;
export const OPPORTUNITY_LEADING_PAGE_LABEL = "Leading page";
export const OPPORTUNITY_REVIEW_LABEL = "Review this opportunity";
export const OPPORTUNITY_EMPTY_COPY = "Google hasn’t reported searches for this period yet.";
export const OPPORTUNITY_NO_ELIGIBLE_COPY =
  "Foundfy doesn’t yet have a search with a clear existing page to review.";
export const OPPORTUNITY_TRUNCATED_COPY =
  "Foundfy imports a bounded set of Google Search data, so other searches may exist.";
export const OPPORTUNITY_UNMAPPED_COPY =
  "This Google Search URL is not in the current crawl sample.";
export const OPPORTUNITY_LEADING_PAGE_COPY = "This is the leading page Foundfy sees for this search.";
export const OPPORTUNITY_VARIANTS_HEADING = "Searches Google reported";
export const OPPORTUNITY_ERROR_COPY = "Foundfy couldn’t load search demand right now.";

export function opportunityPagePath(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return rawUrl;
  }
}

export function formatOpportunityCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function formatOpportunityPosition(position: number): string {
  return position.toFixed(1);
}

export function opportunityMetricsCopy(card: QueryOpportunityCard): string {
  return `${formatOpportunityCount(card.appearances)} appearances · ${formatOpportunityCount(card.visits)} visits · Avg position ${formatOpportunityPosition(card.position)}`;
}

export function opportunityAppearancesCopy(
  card: QueryOpportunityCard,
  windowDays: number,
): string {
  return `Your website appeared ${formatOpportunityCount(card.appearances)} times for this search in the last ${windowDays} days.`;
}
