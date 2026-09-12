import {
  discoverDefaultSitemapUrls,
  discoverRobotsUrl,
  isAllowedByRobots,
  parseRobotsTxt,
} from "../discover/robots";
import { isSitemapIndex, parseSitemapXml } from "../discover/sitemap";
import { ZERO_PAGE_CRAWL_FAILURE_MESSAGE } from "../crawl-usability";
import {
  claimNextQueuedRun,
  enqueueUrl,
  findPageByRequestedUrl,
  getCrawlRunSummary,
  getNextQueueItem,
  hasSitemapArtifacts,
  incrementCrawlProgress,
  listQueueUrls,
  markCrawlRunCompleted,
  markCrawlRunFailed,
  reconcileOrphanedPageProgress,
  saveLinks,
  saveParsedPage,
  saveSiteArtifact,
  toActiveCrawlRun,
  updateQueueItem,
  type ActiveCrawlRun,
} from "../db/repository";
import { generateObservationsForCrawlRun } from "@/lib/observations/db/repository";
import { parseHtmlPage } from "../parse/page";
import { SsrfValidationError, ssrfSafeFetch } from "../security/ssrf-fetch";
import {
  SEED_QUEUE_PRIORITY,
  scorePageUrl,
  selectSitemapEnqueueUrls,
} from "../select/page-priority";
import type { RobotsRules } from "../types";
import { FinalUrlDeduplicator } from "../url/final-url-dedup";
import { getOriginForHostname, isSameSite, normalizeCrawlUrl } from "../url/normalize";

type QueueRow = {
  id: string;
  url: string;
  depth: number;
  priority: number;
  status: string;
};

type CrawlWorkerContext = {
  run: ActiveCrawlRun;
  origin: string;
  robotsRules: RobotsRules;
  discoveredUrls: Set<string>;
  finalUrlDedup: FinalUrlDeduplicator;
  trackDiscovery: (url: string, depth: number, priority: number) => Promise<void>;
};

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

async function hydrateDiscoveredUrls(
  crawlRunId: string,
  discoveredUrls: Set<string>,
): Promise<void> {
  for (const url of await listQueueUrls(crawlRunId)) {
    discoveredUrls.add(url);
  }
}

function isSeedQueueItem(seedUrl: string, queueUrl: string, origin: string): boolean {
  const normalizedSeed = normalizeCrawlUrl(seedUrl, origin);
  const normalizedQueue = normalizeCrawlUrl(queueUrl, origin);
  return Boolean(normalizedSeed && normalizedQueue && normalizedSeed === normalizedQueue);
}

async function processQueueItem(
  queueItem: QueueRow,
  ctx: CrawlWorkerContext,
): Promise<void> {
  const { run, origin, robotsRules, finalUrlDedup, trackDiscovery, discoveredUrls } = ctx;

  await updateQueueItem(queueItem.id, "processing");

  if (!isSameSite(queueItem.url, run.hostname)) {
    await updateQueueItem(queueItem.id, "skipped", "external_url");
    return;
  }

  let pathname = "/";
  try {
    pathname = new URL(queueItem.url).pathname;
  } catch {
    await updateQueueItem(queueItem.id, "skipped", "invalid_url");
    return;
  }

  if (!isAllowedByRobots(pathname, robotsRules)) {
    await updateQueueItem(queueItem.id, "skipped", "robots_disallow");
    return;
  }

  const existingPage = await findPageByRequestedUrl(run.id, queueItem.url);
  if (existingPage) {
    finalUrlDedup.registerCrawledPage({
      requestedUrl: queueItem.url,
      finalUrl: existingPage.finalUrl,
      redirectChain: [],
    });
    await reconcileOrphanedPageProgress(run.id);
    await updateQueueItem(queueItem.id, "done");
    return;
  }

  if (finalUrlDedup.isDuplicateBeforeFetch(queueItem.url)) {
    await updateQueueItem(queueItem.id, "skipped", "duplicate_final_url");
    return;
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
    return;
  }

  const contentType = fetched.headers["content-type"] ?? "";
  if (!contentType.includes("text/html") && !fetched.body.includes("<html")) {
    await updateQueueItem(queueItem.id, "skipped", "non_html");
    return;
  }

  if (finalUrlDedup.isDuplicateAfterFetch(fetched.requestedUrl, fetched.finalUrl)) {
    finalUrlDedup.registerRedirectOnly({
      requestedUrl: fetched.requestedUrl,
      finalUrl: fetched.finalUrl,
      redirectChain: fetched.redirectChain,
    });
    await updateQueueItem(queueItem.id, "skipped", "duplicate_final_url");
    return;
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

  const navigationUrlSet = new Set(parsed.navigationUrls);

  for (const link of parsed.internalLinks) {
    const source = navigationUrlSet.has(link.url) ? "navigation" : "internal";
    await trackDiscovery(link.url, queueItem.depth + 1, scorePageUrl(link.url, source));
  }

  await incrementCrawlProgress(run.id, 1, 0);
  await syncDiscoveredCount(run.id, discoveredUrls.size);
  await updateQueueItem(queueItem.id, "done");
}

async function processSeedBeforeSitemapDiscovery(ctx: CrawlWorkerContext): Promise<void> {
  const summary = await getCrawlRunSummary(ctx.run.id);
  if (!summary || summary.pagesCrawled >= ctx.run.maxPages) {
    return;
  }

  const seedQueueItem = await getNextQueueItem(ctx.run.id);
  if (!seedQueueItem || !isSeedQueueItem(ctx.run.seedUrl, seedQueueItem.url, ctx.origin)) {
    return;
  }

  await processQueueItem(seedQueueItem, ctx);
}

async function enqueueSitemapDiscoveries(
  ctx: CrawlWorkerContext,
  sitemapUrls: string[],
): Promise<void> {
  for (const item of selectSitemapEnqueueUrls(sitemapUrls)) {
    await ctx.trackDiscovery(item.url, 0, item.priority);
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

  const ctx: CrawlWorkerContext = {
    run,
    origin,
    robotsRules: { sitemaps: [], disallow: [], allow: [] },
    discoveredUrls,
    finalUrlDedup,
    trackDiscovery,
  };

  try {
    const robotsUrl = discoverRobotsUrl(origin);
    const robotsFetch = await fetchArtifact(robotsUrl);
    ctx.robotsRules = robotsFetch
      ? parseRobotsTxt(robotsFetch.body)
      : { sitemaps: [], disallow: [], allow: [] };

    await saveSiteArtifact({
      crawlRunId: run.id,
      websiteId: run.websiteId,
      artifactType: "robots_txt",
      url: robotsUrl,
      statusCode: robotsFetch?.statusCode ?? null,
      content: robotsFetch?.body ?? null,
      parsed: ctx.robotsRules,
    });

    await trackDiscovery(run.seedUrl, 0, SEED_QUEUE_PRIORITY);
    await processSeedBeforeSitemapDiscovery(ctx);

    if (await hasSitemapArtifacts(run.id)) {
      await hydrateDiscoveredUrls(run.id, discoveredUrls);
    } else {
      const sitemapUrls = await discoverSiteMaps(origin, ctx.robotsRules, {
        crawlRunId: run.id,
        websiteId: run.websiteId,
      });
      await enqueueSitemapDiscoveries(ctx, sitemapUrls);
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

      await processQueueItem(queueItem, ctx);
    }

    const finalSummary = await getCrawlRunSummary(run.id);
    if (!finalSummary || finalSummary.pagesCrawled === 0) {
      await markCrawlRunFailed(run.id, ZERO_PAGE_CRAWL_FAILURE_MESSAGE, {
        expectedStartedAt: claimedStartedAt,
      });
      return run.id;
    }

    const completed = await markCrawlRunCompleted(run.id, run.websiteId, {
      expectedStartedAt: claimedStartedAt,
    });

    if (completed) {
      try {
        await generateObservationsForCrawlRun(run.id);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Observation generation after crawl completion failed.";
        console.error("[Crawl] Post-completion observation generation failed:", message);
      }
    }

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
