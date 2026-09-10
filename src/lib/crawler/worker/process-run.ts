import {
  discoverDefaultSitemapUrls,
  discoverRobotsUrl,
  isAllowedByRobots,
  parseRobotsTxt,
} from "../discover/robots";
import { isSitemapIndex, parseSitemapXml } from "../discover/sitemap";
import {
  claimNextQueuedRun,
  enqueueUrl,
  getCrawlRunSummary,
  getNextQueueItem,
  incrementCrawlProgress,
  markCrawlRunCompleted,
  markCrawlRunFailed,
  saveLinks,
  saveParsedPage,
  saveSiteArtifact,
  toActiveCrawlRun,
  updateQueueItem,
} from "../db/repository";
import { parseHtmlPage } from "../parse/page";
import { SsrfValidationError, ssrfSafeFetch } from "../security/ssrf-fetch";
import type { RobotsRules } from "../types";
import { FinalUrlDeduplicator } from "../url/final-url-dedup";
import { getOriginForHostname, isSameSite, normalizeCrawlUrl } from "../url/normalize";

async function fetchArtifact(url: string) {
  try {
    return await ssrfSafeFetch(url, {
      headers: {
        accept: "text/plain,application/xml,text/xml,*/*;q=0.8",
      },
    });
  } catch (error) {
    if (error instanceof SsrfValidationError) {
      return null;
    }

    throw error;
  }
}

async function discoverSiteMaps(
  origin: string,
  robotsRules: RobotsRules,
  context: { crawlRunId: string; websiteId: string },
): Promise<string[]> {
  const candidates = new Set<string>([
    ...robotsRules.sitemaps,
    ...discoverDefaultSitemapUrls(origin),
  ]);

  const pageUrls = new Set<string>();

  for (const sitemapUrl of candidates) {
    const normalized = normalizeCrawlUrl(sitemapUrl, origin);
    if (!normalized || !isSameSite(normalized, new URL(origin).hostname)) {
      continue;
    }

    const fetched = await fetchArtifact(normalized);
    if (!fetched || fetched.statusCode >= 400) {
      continue;
    }

    await saveSiteArtifact({
      crawlRunId: context.crawlRunId,
      websiteId: context.websiteId,
      artifactType: "sitemap_xml",
      url: normalized,
      statusCode: fetched.statusCode,
      content: fetched.body,
      parsed: {
        urls: parseSitemapXml(fetched.body, origin),
        isIndex: isSitemapIndex(fetched.body),
      },
    });

    if (isSitemapIndex(fetched.body)) {
      const nestedSitemaps = parseSitemapXml(fetched.body, origin);
      for (const nested of nestedSitemaps.slice(0, 3)) {
        const nestedFetch = await fetchArtifact(nested);
        if (!nestedFetch || nestedFetch.statusCode >= 400) {
          continue;
        }

        for (const pageUrl of parseSitemapXml(nestedFetch.body, origin)) {
          pageUrls.add(pageUrl);
        }
      }
    } else {
      for (const pageUrl of parseSitemapXml(fetched.body, origin)) {
        pageUrls.add(pageUrl);
      }
    }
  }

  return [...pageUrls];
}

async function syncDiscoveredCount(crawlRunId: string, discoveredCount: number) {
  const summary = await getCrawlRunSummary(crawlRunId);
  if (!summary) {
    return;
  }

  const delta = discoveredCount - summary.pagesDiscovered;
  if (delta !== 0) {
    await incrementCrawlProgress(crawlRunId, 0, delta);
  }
}

export async function processCrawlRun(preferredRunId?: string): Promise<string | null> {
  const claimed = await claimNextQueuedRun(preferredRunId);
  if (!claimed) {
    return null;
  }

  const claimedStartedAt = claimed.started_at;

  const run = toActiveCrawlRun(claimed);
  if (!run) {
    await markCrawlRunFailed(claimed.id, "Website record missing for crawl run.", {
      expectedStartedAt: claimedStartedAt,
    });
    return claimed.id;
  }

  const origin = getOriginForHostname(run.hostname);
  const discoveredUrls = new Set<string>();
  const finalUrlDedup = new FinalUrlDeduplicator();

  const trackDiscovery = async (
    url: string,
    depth: number,
    priority: number,
  ): Promise<void> => {
    const normalized = normalizeCrawlUrl(url, origin);
    if (!normalized || !isSameSite(normalized, run.hostname)) {
      return;
    }

    if (discoveredUrls.has(normalized)) {
      return;
    }

    discoveredUrls.add(normalized);
    await enqueueUrl({
      crawlRunId: run.id,
      url: normalized,
      depth,
      priority,
    });
  };

  try {
    const robotsUrl = discoverRobotsUrl(origin);
    const robotsFetch = await fetchArtifact(robotsUrl);
    const robotsRules = robotsFetch
      ? parseRobotsTxt(robotsFetch.body)
      : { sitemaps: [], disallow: [], allow: [] };

    await saveSiteArtifact({
      crawlRunId: run.id,
      websiteId: run.websiteId,
      artifactType: "robots_txt",
      url: robotsUrl,
      statusCode: robotsFetch?.statusCode ?? null,
      content: robotsFetch?.body ?? null,
      parsed: robotsRules,
    });

    await trackDiscovery(run.seedUrl, 0, 100);

    const sitemapUrls = await discoverSiteMaps(origin, robotsRules, {
      crawlRunId: run.id,
      websiteId: run.websiteId,
    });
    for (const sitemapUrl of sitemapUrls.slice(0, 25)) {
      await trackDiscovery(sitemapUrl, 0, 50);
    }

    await syncDiscoveredCount(run.id, discoveredUrls.size);

    while (true) {
      const summary = await getCrawlRunSummary(run.id);
      if (!summary || summary.pagesCrawled >= run.maxPages) {
        break;
      }

      const queueItem = await getNextQueueItem(run.id);
      if (!queueItem) {
        break;
      }

      await updateQueueItem(queueItem.id, "processing");

      if (!isSameSite(queueItem.url, run.hostname)) {
        await updateQueueItem(queueItem.id, "skipped", "external_url");
        continue;
      }

      let pathname = "/";
      try {
        pathname = new URL(queueItem.url).pathname;
      } catch {
        await updateQueueItem(queueItem.id, "skipped", "invalid_url");
        continue;
      }

      if (!isAllowedByRobots(pathname, robotsRules)) {
        await updateQueueItem(queueItem.id, "skipped", "robots_disallow");
        continue;
      }

      if (finalUrlDedup.isDuplicateBeforeFetch(queueItem.url)) {
        await updateQueueItem(queueItem.id, "skipped", "duplicate_final_url");
        continue;
      }

      let fetched;
      try {
        fetched = await ssrfSafeFetch(queueItem.url);
      } catch (error) {
        const message =
          error instanceof SsrfValidationError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Fetch failed";

        await updateQueueItem(queueItem.id, "failed", message);
        continue;
      }

      const contentType = fetched.headers["content-type"] ?? "";
      if (!contentType.includes("text/html") && !fetched.body.includes("<html")) {
        await updateQueueItem(queueItem.id, "skipped", "non_html");
        continue;
      }

      if (
        finalUrlDedup.isDuplicateAfterFetch(fetched.requestedUrl, fetched.finalUrl)
      ) {
        finalUrlDedup.registerRedirectOnly({
          requestedUrl: fetched.requestedUrl,
          finalUrl: fetched.finalUrl,
          redirectChain: fetched.redirectChain,
        });
        await updateQueueItem(queueItem.id, "skipped", "duplicate_final_url");
        continue;
      }

      const parsed = parseHtmlPage(fetched, run.hostname);

      finalUrlDedup.registerCrawledPage({
        requestedUrl: parsed.requestedUrl,
        finalUrl: parsed.finalUrl,
        redirectChain: parsed.redirectChain,
      });

      const pageId = await saveParsedPage({
        crawlRunId: run.id,
        websiteId: run.websiteId,
        parsed,
      });

      await saveLinks({
        crawlRunId: run.id,
        fromPageId: pageId,
        links: [
          ...parsed.internalLinks.map((link) => ({
            url: link.url,
            anchorText: link.anchorText,
            linkType: "internal" as const,
          })),
          ...parsed.externalLinks.map((link) => ({
            url: link.url,
            anchorText: link.anchorText,
            linkType: "external" as const,
          })),
        ],
      });

      for (const link of parsed.internalLinks) {
        await trackDiscovery(link.url, queueItem.depth + 1, 10);
      }

      await incrementCrawlProgress(run.id, 1, 0);
      await syncDiscoveredCount(run.id, discoveredUrls.size);
      await updateQueueItem(queueItem.id, "done");
    }

    await markCrawlRunCompleted(run.id, run.websiteId, {
      expectedStartedAt: claimedStartedAt,
    });
    return run.id;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected crawl worker failure.";
    await markCrawlRunFailed(run.id, message, {
      expectedStartedAt: claimedStartedAt,
    });
    return run.id;
  }
}
