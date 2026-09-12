import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import { normalizeCrawlUrl, normalizeSiteHostname } from "@/lib/crawler/url/normalize";
import { extractSitemapUrls, hasNoindex } from "@/lib/observations/utils";
import type { CrawlEvidenceContext } from "@/lib/observations/types";

export type HomepageBlockKind = "non_200" | "noindex" | "robots_disallow";
export type HomepageDiscovery = "sitemap" | "internal_links";

export type SearchPresenceSignals = {
  homepageBlock: HomepageBlockKind | null;
  homepageDiscovery: HomepageDiscovery | null;
};

export type SearchPresenceCopy = {
  title: string;
  description: string;
  brief: string;
};

const HOMEPAGE_BLOCK_RULES: Record<string, HomepageBlockKind> = {
  "indexability.non_200_page": "non_200",
  "indexability.noindex": "noindex",
  "indexability.robots_blocked_url": "robots_disallow",
};

const OPENED = "We could open your website.";
const NO_BLOCK =
  'We didn\'t find an obvious "don\'t crawl / don\'t list this" instruction on the main page.';
const IN_SITEMAP = "That page is in your sitemap.";
const LINKED = "That page is linked from the pages we fetched.";
const GOOGLE_UNKNOWN =
  "We cannot see whether Google has listed your site, or whether people find it when they search.";
const JOBS_BELOW =
  "If something on the site is blocking search engines, it will show up as a job below.";

export function isHomepageUrl(
  url: string | null | undefined,
  hostname?: string,
): boolean {
  if (!url) {
    return false;
  }

  const normalized = normalizeCrawlUrl(url);
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    const path = parsed.pathname || "/";
    if (path !== "/") {
      return false;
    }

    if (!hostname) {
      return true;
    }

    return (
      normalizeSiteHostname(parsed.hostname) === normalizeSiteHostname(hostname)
    );
  } catch {
    return false;
  }
}

function findingUrls(finding: AnalysisFinding): string[] {
  const urls: string[] = [];
  if (finding.pageUrl) {
    urls.push(finding.pageUrl);
  }

  for (const key of ["requestedUrl", "finalUrl", "queueUrl"] as const) {
    const value = finding.evidence[key];
    if (typeof value === "string" && value.length > 0) {
      urls.push(value);
    }
  }

  return urls;
}

export function detectHomepageBlockFromFindings(
  findings: AnalysisFinding[],
  hostname?: string,
): HomepageBlockKind | null {
  for (const finding of findings) {
    const kind = HOMEPAGE_BLOCK_RULES[finding.ruleKey];
    if (!kind) {
      continue;
    }

    if (findingUrls(finding).some((url) => isHomepageUrl(url, hostname))) {
      return kind;
    }
  }

  return null;
}

export function detectHomepageBlockFromEvidence(
  context: CrawlEvidenceContext,
): HomepageBlockKind | null {
  for (const page of context.pages) {
    if (
      !isHomepageUrl(page.requestedUrl, context.hostname) &&
      !isHomepageUrl(page.finalUrl, context.hostname)
    ) {
      continue;
    }

    if (page.statusCode !== null && page.statusCode !== 200) {
      return "non_200";
    }

    if (hasNoindex(page.robotsMeta, page.xRobotsTag)) {
      return "noindex";
    }
  }

  for (const item of context.queue) {
    if (
      item.skipReason === "robots_disallow" &&
      isHomepageUrl(item.url, context.hostname)
    ) {
      return "robots_disallow";
    }
  }

  return null;
}

export function detectHomepageDiscovery(
  context: CrawlEvidenceContext,
): HomepageDiscovery | null {
  const sitemapUrls = extractSitemapUrls(
    context.artifacts.filter((artifact) => artifact.artifactType === "sitemap_xml"),
  );

  if (sitemapUrls.some((url) => isHomepageUrl(url, context.hostname))) {
    return "sitemap";
  }

  const homepagePageIds = new Set(
    context.pages
      .filter(
        (page) =>
          isHomepageUrl(page.requestedUrl, context.hostname) ||
          isHomepageUrl(page.finalUrl, context.hostname),
      )
      .map((page) => page.id),
  );

  const linkedFromFetchedPages = context.links.some(
    (link) =>
      link.linkType === "internal" &&
      isHomepageUrl(link.toUrl, context.hostname) &&
      !homepagePageIds.has(link.fromPageId),
  );

  return linkedFromFetchedPages ? "internal_links" : null;
}

export function deriveSearchPresenceSignals(
  context: CrawlEvidenceContext | null,
  findings: AnalysisFinding[],
): SearchPresenceSignals {
  if (!context) {
    return {
      homepageBlock: detectHomepageBlockFromFindings(findings),
      homepageDiscovery: null,
    };
  }

  return {
    homepageBlock:
      detectHomepageBlockFromEvidence(context) ??
      detectHomepageBlockFromFindings(findings, context.hostname),
    homepageDiscovery: detectHomepageDiscovery(context),
  };
}

export function formatSearchPresenceCopy(
  discovery: HomepageDiscovery | null = null,
): SearchPresenceCopy {
  const discoveryLine =
    discovery === "sitemap" ? IN_SITEMAP : discovery === "internal_links" ? LINKED : null;
  const description = [NO_BLOCK, discoveryLine, GOOGLE_UNKNOWN, JOBS_BELOW]
    .filter((part): part is string => Boolean(part))
    .join(" ");

  return {
    title: OPENED,
    description,
    brief: `${OPENED} ${description}`,
  };
}

export function shouldLeadWithExistingJobs(input: {
  homepageBlock: HomepageBlockKind | null;
  hasActionableHighlights: boolean;
}): boolean {
  return input.homepageBlock !== null || input.hasActionableHighlights;
}
