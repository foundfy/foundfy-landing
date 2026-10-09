import { WEBSITE_GOAL_TYPE_LABELS } from "@/lib/goals/display";
import type { RuleKey } from "@/lib/observations/types";
import type { GoalSnapshot } from "./types";

export function displayPath(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const path = `${parsed.pathname}${parsed.search}` || "/";
    return path;
  } catch {
    return rawUrl;
  }
}

const ACTION_BY_RULE: Partial<Record<RuleKey, (path: string) => string>> = {
  "page_fundamentals.missing_title": (path) => `Improve the page title on ${path}`,
  "page_fundamentals.title_length_out_of_range": (path) => `Review the page title on ${path}`,
  "page_fundamentals.missing_meta_description": (path) =>
    `Add a meta description on ${path}`,
  "page_fundamentals.duplicate_title": (path) => `Make the page title unique on ${path}`,
  "page_fundamentals.duplicate_meta_description": (path) =>
    `Make the meta description unique on ${path}`,
  "page_fundamentals.missing_h1": (path) => `Review the main heading on ${path}`,
  "page_fundamentals.multiple_h1": (path) => `Review the main headings on ${path}`,
  "indexability.canonical_missing": (path) => `Review canonical setup on ${path}`,
  "indexability.canonical_points_elsewhere": (path) =>
    `Review the canonical URL on ${path}`,
  "indexability.noindex": (path) => `Review the noindex signal on ${path}`,
  "indexability.non_200_page": (path) => `Fix the HTTP error on ${path}`,
  "indexability.robots_blocked_url": (path) => `Review robots.txt blocking on ${path}`,
  "indexability.redirecting_url": (path) => `Review the redirect on ${path}`,
  "internal_structure.zero_internal_links": (path) => `Add internal links on ${path}`,
  "internal_structure.broken_internal_link": (path) =>
    `Fix the broken internal link on ${path}`,
  "internal_structure.orphan_sitemap_page": (path) =>
    `Review internal links to ${path}`,
};

export function actionTitleForRule(ruleKey: RuleKey, pageUrl: string): string {
  const path = displayPath(pageUrl);
  const builder = ACTION_BY_RULE[ruleKey];
  if (builder) {
    return builder(path);
  }

  return `Review ${path}`;
}

export function inspectPageTitle(pageUrl: string): string {
  return `Analyze this Google-visible page next: ${displayPath(pageUrl)}`;
}

export function duplicateIssueTitle(
  ruleKey: "page_fundamentals.duplicate_title" | "page_fundamentals.duplicate_meta_description",
  visibleCount: number,
  sampleUrl: string,
): string {
  const noun = ruleKey === "page_fundamentals.duplicate_title" ? "titles" : "meta descriptions";
  if (visibleCount <= 1) {
    return actionTitleForRule(ruleKey, sampleUrl);
  }

  return `Make duplicate ${noun} unique on ${visibleCount} Google-visible pages including ${displayPath(sampleUrl)}`;
}

export function pageIssueExplanation(issueTitle: string, ruleKey?: string): string {
  if (ruleKey === "page_fundamentals.missing_h1") {
    return "This page already appears in Google Search, and Foundfy did not find an H1 heading on it. A clear main heading can help describe the page, but Foundfy does not yet know where a heading should safely be added.";
  }

  if (ruleKey === "page_fundamentals.multiple_h1") {
    return "This page already appears in Google Search, and Foundfy found more than one H1 heading. Check which heading should represent the page's main topic.";
  }

  if (ruleKey === "indexability.canonical_missing") {
    return "This page already appears in Google Search, and Foundfy did not find a canonical URL on it. A canonical can indicate which URL should be treated as the preferred version, but Foundfy does not yet know which URL is intended here.";
  }

  return `This page already appears in Google Search, and Foundfy found a ${issueTitle.toLowerCase()} on the same page.`;
}

export function inspectPageExplanation(): string {
  return "Google is already showing this page, and Foundfy has not yet included it in the current crawl sample.";
}

export function multiPageExplanation(issueTitle: string, visibleCount: number, sampleUrl?: string): string {
  const shared = `${visibleCount} pages that already appear in Google Search share a ${issueTitle.toLowerCase()}`;
  if (!sampleUrl) {
    return `${shared}.`;
  }

  return `${shared}, including ${displayPath(sampleUrl)}.`;
}

export function goalContextCopy(goal: GoalSnapshot): string {
  const label = WEBSITE_GOAL_TYPE_LABELS[goal.primaryType];
  const framed = label.charAt(0).toLowerCase() + label.slice(1);
  return `Because your goal is to ${framed}, Foundfy is prioritizing improvements on pages that already receive Google visibility before suggesting speculative new content.`;
}

export function matchingConfidenceCopy(confidence: string): string {
  if (confidence === "unmapped_page") {
    return "This URL is reported by Google Search but is not in the current crawl sample.";
  }

  if (confidence === "bounded_dataset") {
    return "Foundfy matched this page exactly, using a bounded Google Search import.";
  }

  return "Foundfy matched this Google Search URL to a crawled page.";
}
