import type { RuleKey } from "@/lib/observations/types";

export type RuleRecommendation = {
  title: string;
  whyItMatters: string;
  recommendedAction: string;
  verification: string | null;
};

export const RULE_RECOMMENDATIONS: Record<RuleKey, RuleRecommendation> = {
  "indexability.non_200_page": {
    title: "Fix non-success page response",
    whyItMatters:
      "Pages that do not return HTTP 200 may not be indexed or may provide a poor experience when discovered.",
    recommendedAction:
      "Resolve the underlying server or routing issue so this URL returns a successful response.",
    verification: "Re-crawl the URL and confirm it returns HTTP 200.",
  },
  "indexability.robots_blocked_url": {
    title: "Review robots.txt block",
    whyItMatters:
      "Search engines may be prevented from crawling this URL, which can limit discovery and indexing.",
    recommendedAction:
      "Update robots.txt or remove the disallow rule if this URL should be crawled and indexed.",
    verification: "Confirm the URL is allowed in robots.txt and can be fetched.",
  },
  "indexability.noindex": {
    title: "Remove unintended noindex",
    whyItMatters:
      "A noindex signal tells search engines not to include this page in search results.",
    recommendedAction:
      "Remove noindex from robots meta tags or HTTP headers if this page should appear in search.",
    verification: "Confirm the page no longer emits noindex directives.",
  },
  "indexability.redirecting_url": {
    title: "Review redirect chain",
    whyItMatters:
      "Redirects add an extra hop before the final page and can dilute URL signals if overused.",
    recommendedAction:
      "Use the final URL as the canonical entry point where possible, and keep redirect chains short.",
    verification: "Confirm the preferred URL resolves directly or with a single redirect.",
  },
  "indexability.canonical_missing": {
    title: "Add a canonical URL",
    whyItMatters:
      "Without a preferred URL, search engines may treat copies of this page as separate results.",
    recommendedAction:
      "Add a canonical link that points to the preferred URL for this page.",
    verification: "Scan again and confirm the page HTML includes a canonical tag.",
  },
  "indexability.canonical_points_elsewhere": {
    title: "Align canonical with final URL",
    whyItMatters:
      "This page tells Google another page is the real one, so Google may show that other page instead.",
    recommendedAction:
      "Decide whether this page should stay its own URL, or redirect to the page it currently points at.",
    verification: "Scan again and confirm the canonical URL matches the page you want shown.",
  },
  "page_fundamentals.missing_title": {
    title: "Add a page title",
    whyItMatters:
      "Search engines and users rely on the page title to understand what the page is about.",
    recommendedAction:
      "Add a unique, descriptive title that accurately represents this page.",
    verification: "Confirm the page HTML includes a non-empty title element.",
  },
  "page_fundamentals.duplicate_title": {
    title: "Differentiate duplicate titles",
    whyItMatters:
      "When several pages share one title, search results can look the same and people may open the wrong page.",
    recommendedAction:
      "Give each affected page a unique title that reflects its specific content.",
    verification: "Scan again and confirm the affected pages no longer share the same title.",
  },
  "page_fundamentals.title_length_out_of_range": {
    title: "Adjust title length",
    whyItMatters:
      "Very short or long titles may truncate in search results and reduce clarity.",
    recommendedAction:
      "Rewrite the title to stay within the recommended 30–60 character range while staying descriptive.",
    verification: "Confirm the updated title length is within range.",
  },
  "page_fundamentals.missing_meta_description": {
    title: "Add a meta description",
    whyItMatters:
      "Meta descriptions help search engines and users understand the page summary in results.",
    recommendedAction:
      "Add a concise meta description that accurately summarizes this page.",
    verification: "Confirm the page HTML includes a meta description.",
  },
  "page_fundamentals.duplicate_meta_description": {
    title: "Differentiate duplicate descriptions",
    whyItMatters:
      "Shared meta descriptions across pages reduce clarity in search snippets.",
    recommendedAction:
      "Write a unique meta description for each affected page.",
    verification: "Confirm affected pages no longer share the same description.",
  },
  "page_fundamentals.missing_h1": {
    title: "Add an H1 heading",
    whyItMatters:
      "A clear H1 helps users and search engines identify the main topic of the page.",
    recommendedAction:
      "Add one primary H1 heading that reflects the page topic.",
    verification: "Confirm the page contains exactly one meaningful H1.",
  },
  "page_fundamentals.multiple_h1": {
    title: "Use a single primary H1",
    whyItMatters:
      "Multiple H1 headings can make the page topic less clear.",
    recommendedAction:
      "Keep one primary H1 and demote additional headings to H2 or lower.",
    verification: "Confirm only one H1 remains on the page.",
  },
  "internal_structure.zero_internal_links": {
    title: "Add internal links",
    whyItMatters:
      "Internal links help search engines discover related pages and understand site structure.",
    recommendedAction:
      "Add relevant internal links from this page to other important pages on the site.",
    verification: "Confirm the page includes at least one internal link.",
  },
  "internal_structure.broken_internal_link": {
    title: "Fix broken internal link",
    whyItMatters:
      "Broken internal links interrupt navigation and can waste crawl budget on dead ends.",
    recommendedAction:
      "Update or remove the link, or fix the destination page so it returns HTTP 200.",
    verification: "Confirm the linked URL returns a successful response.",
  },
  "internal_structure.orphan_sitemap_page": {
    title: "Link to sitemap-only page",
    whyItMatters:
      "Pages listed in the sitemap but not linked internally may be harder for crawlers to discover through navigation.",
    recommendedAction:
      "Add internal links to this page from relevant site sections.",
    verification: "Confirm at least one internal link points to this URL.",
  },
  "site_discovery.robots_txt_missing": {
    title: "Publish robots.txt",
    whyItMatters:
      "robots.txt helps crawlers understand which parts of the site should be fetched.",
    recommendedAction:
      "Publish a valid robots.txt file at the site root.",
    verification: "Confirm robots.txt is reachable and returns HTTP 200.",
  },
  "site_discovery.sitemap_missing": {
    title: "Publish a sitemap",
    whyItMatters:
      "A sitemap helps search engines discover important URLs on the site.",
    recommendedAction:
      "Publish a sitemap.xml and reference it from robots.txt.",
    verification: "Confirm sitemap.xml is reachable and lists key URLs.",
  },
  "site_discovery.sitemap_url_issue": {
    title: "Fix sitemap URL issue",
    whyItMatters:
      "URLs listed in the sitemap should be crawlable and return successful responses.",
    recommendedAction:
      "Resolve the crawl or response issue for the affected sitemap URL.",
    verification: "Confirm the sitemap URL returns HTTP 200 when crawled.",
  },
};

export function getRuleRecommendation(ruleKey: RuleKey): RuleRecommendation {
  return RULE_RECOMMENDATIONS[ruleKey];
}
