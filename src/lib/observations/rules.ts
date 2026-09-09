import type { RuleDefinition, RuleKey } from "./types";

export const RULE_DEFINITIONS: Record<RuleKey, RuleDefinition> = {
  "indexability.non_200_page": {
    key: "indexability.non_200_page",
    category: "indexability",
    severity: "error",
    title: "Page did not return HTTP 200",
    description: "A crawled page returned a non-success status code.",
    supported: true,
  },
  "indexability.robots_blocked_url": {
    key: "indexability.robots_blocked_url",
    category: "indexability",
    severity: "warning",
    title: "URL blocked by robots.txt",
    description: "A discovered URL was skipped because robots.txt disallows crawling it.",
    supported: true,
  },
  "indexability.noindex": {
    key: "indexability.noindex",
    category: "indexability",
    severity: "warning",
    title: "Page marked noindex",
    description: "The page signals that it should not be indexed.",
    supported: true,
  },
  "indexability.redirecting_url": {
    key: "indexability.redirecting_url",
    category: "indexability",
    severity: "info",
    title: "URL redirects before final page",
    description: "The requested URL redirects to a different final URL.",
    supported: true,
  },
  "indexability.canonical_missing": {
    key: "indexability.canonical_missing",
    category: "indexability",
    severity: "warning",
    title: "Canonical URL missing",
    description: "An indexable HTML page does not declare a canonical URL.",
    supported: true,
  },
  "indexability.canonical_points_elsewhere": {
    key: "indexability.canonical_points_elsewhere",
    category: "indexability",
    severity: "warning",
    title: "Canonical points elsewhere",
    description: "The declared canonical URL differs from the final crawled URL.",
    supported: true,
  },
  "page_fundamentals.missing_title": {
    key: "page_fundamentals.missing_title",
    category: "page_fundamentals",
    severity: "error",
    title: "Missing page title",
    description: "The page does not have a title element.",
    supported: true,
  },
  "page_fundamentals.duplicate_title": {
    key: "page_fundamentals.duplicate_title",
    category: "page_fundamentals",
    severity: "warning",
    title: "Duplicate page title",
    description: "Multiple pages share the same title.",
    supported: true,
  },
  "page_fundamentals.title_length_out_of_range": {
    key: "page_fundamentals.title_length_out_of_range",
    category: "page_fundamentals",
    severity: "info",
    title: "Title length outside recommended range",
    description: "The page title length is outside the recommended 30–60 character range.",
    supported: true,
  },
  "page_fundamentals.missing_meta_description": {
    key: "page_fundamentals.missing_meta_description",
    category: "page_fundamentals",
    severity: "warning",
    title: "Missing meta description",
    description: "The page does not provide a meta description.",
    supported: true,
  },
  "page_fundamentals.duplicate_meta_description": {
    key: "page_fundamentals.duplicate_meta_description",
    category: "page_fundamentals",
    severity: "warning",
    title: "Duplicate meta description",
    description: "Multiple pages share the same meta description.",
    supported: true,
  },
  "page_fundamentals.missing_h1": {
    key: "page_fundamentals.missing_h1",
    category: "page_fundamentals",
    severity: "warning",
    title: "Missing H1",
    description: "The page does not contain an H1 heading.",
    supported: true,
  },
  "page_fundamentals.multiple_h1": {
    key: "page_fundamentals.multiple_h1",
    category: "page_fundamentals",
    severity: "warning",
    title: "Multiple H1 headings",
    description: "The page contains more than one H1 heading.",
    supported: true,
  },
  "internal_structure.zero_internal_links": {
    key: "internal_structure.zero_internal_links",
    category: "internal_structure",
    severity: "warning",
    title: "No outgoing internal links",
    description: "The page does not link to any other internal pages.",
    supported: true,
  },
  "internal_structure.broken_internal_link": {
    key: "internal_structure.broken_internal_link",
    category: "internal_structure",
    severity: "error",
    title: "Broken internal link to crawled page",
    description:
      "An internal link points to another crawled page that returned a non-200 status.",
    supported: true,
  },
  "internal_structure.orphan_sitemap_page": {
    key: "internal_structure.orphan_sitemap_page",
    category: "internal_structure",
    severity: "info",
    title: "Sitemap page lacks internal links",
    description:
      "A URL listed in the sitemap was crawled but no internal links pointed to it during this crawl.",
    supported: true,
  },
  "site_discovery.robots_txt_missing": {
    key: "site_discovery.robots_txt_missing",
    category: "site_discovery",
    severity: "warning",
    title: "robots.txt missing or unreachable",
    description: "robots.txt could not be fetched successfully during the crawl.",
    supported: true,
  },
  "site_discovery.sitemap_missing": {
    key: "site_discovery.sitemap_missing",
    category: "site_discovery",
    severity: "warning",
    title: "Sitemap missing or unreachable",
    description: "No sitemap.xml could be fetched successfully during the crawl.",
    supported: true,
  },
  "site_discovery.sitemap_url_issue": {
    key: "site_discovery.sitemap_url_issue",
    category: "site_discovery",
    severity: "warning",
    title: "Sitemap URL has crawl issues",
    description:
      "A URL listed in the sitemap was skipped, failed, or returned a non-200 response during the crawl.",
    supported: true,
  },
};

export const UNSUPPORTED_RULES = [
  {
    key: "internal_structure.broken_internal_link_uncrawled",
    reason:
      "Phase 1 does not fetch HTTP status for every discovered internal link target. Broken-link detection is limited to links whose targets were crawled in the same run.",
  },
  {
    key: "indexability.robots_blocked_unqueued",
    reason:
      "Phase 1 only records robots.txt blocks for URLs that entered the crawl queue. Disallowed URLs never discovered are not observable.",
  },
] as const;

export function getRuleDefinition(ruleKey: RuleKey): RuleDefinition {
  return RULE_DEFINITIONS[ruleKey];
}
