import type { CrawlCoverage } from "../types";

export function buildEmptyCoverage(): CrawlCoverage {
  return {
    crawledPageUrls: new Set<string>(),
    requestedToFinal: new Map<string, string>(),
    outgoingLinksBySource: new Map<string, Set<string>>(),
    targetStatusByUrl: new Map<string, number | null>(),
    queuedUrls: new Set<string>(),
    sitemapUrls: new Set<string>(),
  };
}

export function withCrawledPage(
  coverage: CrawlCoverage,
  url: string,
  statusCode = 200,
): CrawlCoverage {
  coverage.crawledPageUrls.add(url);
  coverage.targetStatusByUrl.set(url, statusCode);
  return coverage;
}

export function withBrokenLink(
  coverage: CrawlCoverage,
  sourceUrl: string,
  targetUrl: string,
  targetStatusCode: number | null = 404,
): CrawlCoverage {
  withCrawledPage(coverage, sourceUrl);
  if (targetStatusCode !== null) {
    coverage.targetStatusByUrl.set(targetUrl, targetStatusCode);
    coverage.crawledPageUrls.add(targetUrl);
  }

  const outgoing = coverage.outgoingLinksBySource.get(sourceUrl) ?? new Set<string>();
  outgoing.add(targetUrl);
  coverage.outgoingLinksBySource.set(sourceUrl, outgoing);
  return coverage;
}
