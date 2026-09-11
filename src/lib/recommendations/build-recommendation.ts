import type { RuleKey } from "@/lib/observations/types";
import {
  getRuleRecommendation,
  RULE_RECOMMENDATIONS,
} from "@/lib/priorities/config/recommendations";
import {
  formatDisplayPath,
  formatDisplayUrl,
  formatPageList,
  pageLabel,
  readNumber,
  readString,
  readStringArray,
} from "./evidence";
import type { FindingRecommendation, RecommendationInput } from "./types";

function isRuleKey(value: string): value is RuleKey {
  return Object.prototype.hasOwnProperty.call(RULE_RECOMMENDATIONS, value);
}

function baseRecommendation(ruleKey: RuleKey): FindingRecommendation {
  const template = getRuleRecommendation(ruleKey);
  return {
    whyItMatters: template.whyItMatters,
    recommendedAction: template.recommendedAction,
    verification: template.verification,
  };
}

function withPageContext(
  input: RecommendationInput,
  action: (page: string) => Partial<FindingRecommendation>,
): FindingRecommendation | null {
  const page = pageLabel(input.evidence, input.pageUrl);
  if (!page) {
    return null;
  }

  const base = baseRecommendation(input.ruleKey as RuleKey);
  const overrides = action(page);
  return {
    whyItMatters: overrides.whyItMatters ?? base.whyItMatters,
    recommendedAction: overrides.recommendedAction ?? base.recommendedAction,
    verification: overrides.verification ?? base.verification,
  };
}

function buildBrokenInternalLinkRecommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  const linkToUrl = readString(input.evidence, "linkToUrl");
  const targetStatusCode = readNumber(input.evidence, "targetStatusCode");
  const linkPath = formatDisplayPath(linkToUrl);

  if (!linkPath || targetStatusCode === null) {
    return null;
  }

  const base = baseRecommendation("internal_structure.broken_internal_link");
  return {
    whyItMatters: base.whyItMatters,
    recommendedAction: `Update or remove the link to ${linkPath}. It currently returns ${targetStatusCode}.`,
    verification: `Re-crawl and confirm ${linkPath} returns a successful response or the link is removed.`,
  };
}

function buildNon200Recommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  const page = pageLabel(input.evidence, input.pageUrl);
  const statusCode = readNumber(input.evidence, "statusCode");

  if (!page || statusCode === null) {
    return null;
  }

  const base = baseRecommendation("indexability.non_200_page");
  return {
    whyItMatters: base.whyItMatters,
    recommendedAction: `Fix ${page} so it returns a successful response instead of ${statusCode}.`,
    verification: `Re-crawl ${page} and confirm it returns HTTP 200.`,
  };
}

function buildRedirectRecommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  const requestedUrl =
    readString(input.evidence, "requestedUrl") ?? input.pageUrl;
  const finalUrl = readString(input.evidence, "finalUrl");
  const requestedLabel = formatDisplayUrl(requestedUrl);
  const finalLabel = formatDisplayUrl(finalUrl);

  if (!requestedLabel || !finalLabel) {
    return null;
  }

  const base = baseRecommendation("indexability.redirecting_url");
  return {
    whyItMatters:
      "This URL redirects before the final page loads, which adds an extra hop for visitors and crawlers.",
    recommendedAction:
      requestedLabel === finalLabel
        ? base.recommendedAction
        : `If ${finalLabel} is the preferred page, consider linking directly to it instead of ${requestedLabel}.`,
    verification: `Re-crawl and confirm ${requestedLabel} resolves to the intended final URL with a short redirect chain.`,
  };
}

function buildCanonicalMissingRecommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  return withPageContext(input, (page) => ({
    recommendedAction: `Add a canonical link element on ${page} that points to the preferred URL for this page.`,
    verification: `Re-crawl ${page} and confirm a canonical tag is present.`,
  }));
}

function buildCanonicalElsewhereRecommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  const page = pageLabel(input.evidence, input.pageUrl);
  const canonicalPath = formatDisplayPath(readString(input.evidence, "canonical"));

  if (!page || !canonicalPath) {
    return null;
  }

  const base = baseRecommendation("indexability.canonical_points_elsewhere");
  return {
    whyItMatters: base.whyItMatters,
    recommendedAction: `Review whether ${page} should declare ${canonicalPath} as its canonical URL, or redirect to that URL if it is the preferred version.`,
    verification: `Re-crawl ${page} and confirm the canonical URL matches the intended live page.`,
  };
}

function buildNoindexRecommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  return withPageContext(input, (page) => ({
    recommendedAction: `If ${page} should appear in search results, remove the noindex directive from the page or response headers.`,
    verification: `Re-crawl ${page} and confirm it no longer emits noindex.`,
  }));
}

function buildMissingTitleRecommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  return withPageContext(input, (page) => ({
    recommendedAction: `Add a unique, descriptive title to ${page}.`,
    verification: `Re-crawl ${page} and confirm the page HTML includes a non-empty title.`,
  }));
}

function buildMissingMetaDescriptionRecommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  return withPageContext(input, (page) => ({
    recommendedAction: `Add a concise meta description to ${page} that summarizes the page.`,
    verification: `Re-crawl ${page} and confirm the page HTML includes a meta description.`,
  }));
}

function buildMultipleH1Recommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  const page = pageLabel(input.evidence, input.pageUrl);
  const h1Count = readNumber(input.evidence, "h1Count");

  if (!page || h1Count === null || h1Count < 2) {
    return null;
  }

  const base = baseRecommendation("page_fundamentals.multiple_h1");
  return {
    whyItMatters: base.whyItMatters,
    recommendedAction: `Keep one primary H1 on ${page} and change the other ${h1Count - 1} heading(s) to H2 or lower.`,
    verification: `Re-crawl ${page} and confirm only one H1 remains.`,
  };
}

function buildDuplicateTitleRecommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  const pageCount = readNumber(input.evidence, "pageCount");
  const duplicatePages = readStringArray(input.evidence, "duplicatePages");
  const pageList = formatPageList(duplicatePages);

  if (pageCount === null || pageCount < 2 || !pageList) {
    return null;
  }

  const base = baseRecommendation("page_fundamentals.duplicate_title");
  return {
    whyItMatters: base.whyItMatters,
    recommendedAction: `${pageCount} crawled pages share the same title. Give each page a unique title, starting with ${pageList}.`,
    verification: "Re-crawl and confirm the affected pages no longer share the same title.",
  };
}

function buildDuplicateMetaRecommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  const pageCount = readNumber(input.evidence, "pageCount");
  const duplicatePages = readStringArray(input.evidence, "duplicatePages");
  const pageList = formatPageList(duplicatePages);

  if (pageCount === null || pageCount < 2 || !pageList) {
    return null;
  }

  const base = baseRecommendation("page_fundamentals.duplicate_meta_description");
  return {
    whyItMatters: base.whyItMatters,
    recommendedAction: `${pageCount} crawled pages share the same meta description. Write a unique description for each page, starting with ${pageList}.`,
    verification:
      "Re-crawl and confirm the affected pages no longer share the same meta description.",
  };
}

function buildZeroInternalLinksRecommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  return withPageContext(input, (page) => ({
    recommendedAction: `Add relevant internal links on ${page} to other important pages on the site.`,
    verification: `Re-crawl ${page} and confirm it includes at least one internal link.`,
  }));
}

function buildOrphanSitemapRecommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  const sitemapPath =
    formatDisplayPath(readString(input.evidence, "sitemapUrl")) ??
    formatDisplayPath(readString(input.evidence, "finalUrl")) ??
    pageLabel(input.evidence, input.pageUrl);

  if (!sitemapPath) {
    return null;
  }

  const base = baseRecommendation("internal_structure.orphan_sitemap_page");
  return {
    whyItMatters: base.whyItMatters,
    recommendedAction: `Add internal links to ${sitemapPath} from relevant site sections so crawlers can reach it through navigation.`,
    verification: `Re-crawl and confirm at least one internal link points to ${sitemapPath}.`,
  };
}

function buildRobotsBlockedRecommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  const queuePath =
    formatDisplayPath(readString(input.evidence, "queueUrl")) ??
    formatDisplayPath(input.pageUrl);

  if (!queuePath) {
    return null;
  }

  const base = baseRecommendation("indexability.robots_blocked_url");
  return {
    whyItMatters: base.whyItMatters,
    recommendedAction: `Review robots.txt and allow crawling of ${queuePath} if this page should be indexed.`,
    verification: `Re-crawl and confirm ${queuePath} is allowed and can be fetched.`,
  };
}

function buildSitemapUrlIssueRecommendation(
  input: RecommendationInput,
): FindingRecommendation | null {
  const sitemapPath =
    formatDisplayPath(readString(input.evidence, "sitemapUrl")) ??
    pageLabel(input.evidence, input.pageUrl);
  const statusCode = readNumber(input.evidence, "pageStatusCode");

  if (!sitemapPath) {
    return null;
  }

  const base = baseRecommendation("site_discovery.sitemap_url_issue");
  const statusSuffix =
    statusCode !== null ? ` It currently returns ${statusCode}.` : "";

  return {
    whyItMatters: base.whyItMatters,
    recommendedAction: `Fix the crawl or response issue for ${sitemapPath} so sitemap URLs return successful responses.${statusSuffix}`,
    verification: `Re-crawl and confirm ${sitemapPath} returns HTTP 200.`,
  };
}

const RULE_BUILDERS: Partial<
  Record<RuleKey, (input: RecommendationInput) => FindingRecommendation | null>
> = {
  "internal_structure.broken_internal_link": buildBrokenInternalLinkRecommendation,
  "indexability.non_200_page": buildNon200Recommendation,
  "indexability.redirecting_url": buildRedirectRecommendation,
  "indexability.canonical_missing": buildCanonicalMissingRecommendation,
  "indexability.canonical_points_elsewhere": buildCanonicalElsewhereRecommendation,
  "indexability.noindex": buildNoindexRecommendation,
  "indexability.robots_blocked_url": buildRobotsBlockedRecommendation,
  "page_fundamentals.missing_title": buildMissingTitleRecommendation,
  "page_fundamentals.missing_meta_description": buildMissingMetaDescriptionRecommendation,
  "page_fundamentals.multiple_h1": buildMultipleH1Recommendation,
  "page_fundamentals.duplicate_title": buildDuplicateTitleRecommendation,
  "page_fundamentals.duplicate_meta_description": buildDuplicateMetaRecommendation,
  "internal_structure.zero_internal_links": buildZeroInternalLinksRecommendation,
  "internal_structure.orphan_sitemap_page": buildOrphanSitemapRecommendation,
  "site_discovery.sitemap_url_issue": buildSitemapUrlIssueRecommendation,
};

export function buildFindingRecommendation(
  input: RecommendationInput,
): FindingRecommendation {
  if (!isRuleKey(input.ruleKey)) {
    return {
      whyItMatters: "This finding may affect how the site is crawled or understood.",
      recommendedAction: "Review the finding and address it if it applies to your site.",
      verification: null,
    };
  }

  const builder = RULE_BUILDERS[input.ruleKey];
  const built = builder?.(input);

  if (built) {
    return built;
  }

  return baseRecommendation(input.ruleKey);
}

export function buildGroupedActionRecommendation(
  input: RecommendationInput,
  affectedPageCount: number,
): FindingRecommendation {
  if (input.ruleKey === "internal_structure.broken_internal_link") {
    return buildGroupedBrokenLinkRecommendation(input, affectedPageCount);
  }

  if (!isRuleKey(input.ruleKey) || affectedPageCount < 2) {
    return buildFindingRecommendation(input);
  }

  const base = baseRecommendation(input.ruleKey);
  const pageWord = affectedPageCount === 1 ? "page" : "pages";

  return {
    whyItMatters: base.whyItMatters,
    recommendedAction: `${base.recommendedAction} This affects ${affectedPageCount} ${pageWord}.`,
    verification: base.verification,
  };
}

export function buildGroupedBrokenLinkRecommendation(
  input: RecommendationInput,
  affectedPageCount: number,
): FindingRecommendation {
  const linkToUrl = readString(input.evidence, "linkToUrl");
  const targetStatusCode = readNumber(input.evidence, "targetStatusCode");
  const linkPath = formatDisplayPath(linkToUrl);
  const base = baseRecommendation("internal_structure.broken_internal_link");

  if (!linkPath || targetStatusCode === null || affectedPageCount < 2) {
    return buildFindingRecommendation(input);
  }

  const pageWord = affectedPageCount === 1 ? "page" : "pages";

  return {
    whyItMatters: base.whyItMatters,
    recommendedAction: `The link to ${linkPath} returns ${targetStatusCode} and was found on ${affectedPageCount} crawled ${pageWord}. Update it to the correct destination or remove it if it is no longer needed.`,
    verification: `Re-crawl and confirm ${linkPath} returns a successful response or the link is removed from the affected pages.`,
  };
}
