import type { CrawlEvidenceContext } from "@/lib/observations/types";
import { extractSitemapUrls } from "@/lib/observations/utils";
import type { CrawlCoverage } from "./types";
import { normalizeComparisonUrl } from "./normalize-comparison-url";

export function buildCrawlCoverage(context: CrawlEvidenceContext): CrawlCoverage {
  const crawledPageUrls = new Set<string>();
  const requestedToFinal = new Map<string, string>();
  const outgoingLinksBySource = new Map<string, Set<string>>();
  const targetStatusByUrl = new Map<string, number | null>();
  const queuedUrls = new Set<string>();

  for (const page of context.pages) {
    const requested = normalizeComparisonUrl(page.requestedUrl);
    const finalUrl = normalizeComparisonUrl(page.finalUrl);

    if (requested) {
      crawledPageUrls.add(requested);
      if (finalUrl) {
        requestedToFinal.set(requested, finalUrl);
      }
    }

    if (finalUrl) {
      crawledPageUrls.add(finalUrl);
      targetStatusByUrl.set(finalUrl, page.statusCode);
    }
  }

  for (const link of context.links) {
    if (link.linkType !== "internal") {
      continue;
    }

    const sourcePage = context.pages.find((page) => page.id === link.fromPageId);
    const sourceUrl = normalizeComparisonUrl(sourcePage?.finalUrl ?? sourcePage?.requestedUrl);
    const targetUrl = normalizeComparisonUrl(link.toUrl);

    if (!sourceUrl || !targetUrl) {
      continue;
    }

    const existing = outgoingLinksBySource.get(sourceUrl) ?? new Set<string>();
    existing.add(targetUrl);
    outgoingLinksBySource.set(sourceUrl, existing);
  }

  for (const item of context.queue) {
    const queueUrl = normalizeComparisonUrl(item.url);
    if (queueUrl) {
      queuedUrls.add(queueUrl);
    }
  }

  const sitemapArtifacts = context.artifacts.filter(
    (artifact) => artifact.artifactType === "sitemap_xml",
  );
  const sitemapUrls = new Set(
    extractSitemapUrls(sitemapArtifacts)
      .map((url) => normalizeComparisonUrl(url))
      .filter((url): url is string => url !== null),
  );

  return {
    crawledPageUrls,
    requestedToFinal,
    outgoingLinksBySource,
    targetStatusByUrl,
    queuedUrls,
    sitemapUrls,
  };
}

export function isPageUrlCrawled(
  pageUrl: string | null,
  coverage: CrawlCoverage,
): boolean {
  if (!pageUrl) {
    return false;
  }

  return coverage.crawledPageUrls.has(pageUrl);
}

export function isRequestedUrlCrawled(
  requestedUrl: string | null,
  coverage: CrawlCoverage,
): boolean {
  if (!requestedUrl) {
    return false;
  }

  return (
    coverage.crawledPageUrls.has(requestedUrl) ||
    coverage.requestedToFinal.has(requestedUrl)
  );
}
