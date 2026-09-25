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
  listPageHostVariantEvidence,
  listQueueItems,
  listQueueUrls,
  markCrawlRunCompleted,
  markCrawlRunFailed,
  reconcileOrphanedPageProgress,
  saveLinks,
  saveParsedPage,
  saveSiteArtifact,
  toActiveCrawlRun,
  updateQueueItem,
  updateQueueItemPriority,
  type ActiveCrawlRun,
} from "../db/repository";
import { generateObservationsForCrawlRun } from "@/lib/observations/db/repository";
import { parseHtmlPage } from "../parse/page";
import { SsrfValidationError, ssrfSafeFetch } from "../security/ssrf-fetch";
import {
  SEED_QUEUE_PRIORITY,
  VERIFICATION_QUEUE_PRIORITY,
  scorePageUrl,
  selectSitemapEnqueueUrls,
} from "../select/page-priority";
import {
  GSC_QUEUE_PRIORITY,
  UNSELECTED_QUEUE_PRIORITY,
  assignGscInformedQueuePriorities,
  gscDedupeKey,
  isGscVisibilityQueuePriority,
  selectGscInformedCrawlUrls,
  type CandidateSource,
} from "../select/gsc-informed-selection";
import {
  collapseLatestPageEvidence,
  shouldSkipEquivalentHostVariant,
  type PageHostEvidence,
} from "../select/host-variant-equivalence";
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
  crawledRequestedUrls: string[];
  hostVariantEvidence: PageHostEvidence[];
  finalUrlDedup: FinalUrlDeduplicator;
  selectionLocked: boolean;
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
    ctx.crawledRequestedUrls.push(queueItem.url);
    await reconcileOrphanedPageProgress(run.id);
    await updateQueueItem(queueItem.id, "done");
    return;
  }

  if (finalUrlDedup.isDuplicateBeforeFetch(queueItem.url)) {
    await updateQueueItem(queueItem.id, "skipped", "duplicate_final_url");
    return;
  }

  if (
    shouldSkipEquivalentHostVariant({
      requestedUrl: queueItem.url,
      crawledUrls: ctx.crawledRequestedUrls,
      evidence: ctx.hostVariantEvidence,
      origin,
    })
  ) {
    await updateQueueItem(queueItem.id, "skipped", "equivalent_host_variant");
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
  ctx.crawledRequestedUrls.push(parsed.requestedUrl);
  ctx.hostVariantEvidence = collapseLatestPageEvidence([
    {
      requestedUrl: parsed.requestedUrl,
      finalUrl: parsed.finalUrl,
      canonical: parsed.canonical,
      contentHash: parsed.contentHash,
      redirectChain: parsed.redirectChain,
      statusCode: parsed.statusCode,
    },
    ...ctx.hostVariantEvidence,
  ], origin);

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

function inferCandidateSource(
  item: { url: string; priority: number },
  seedUrl: string,
  origin: string,
): CandidateSource {
  if (item.priority === SEED_QUEUE_PRIORITY || isSeedQueueItem(seedUrl, item.url, origin)) {
    return "seed";
  }

  if (item.priority === VERIFICATION_QUEUE_PRIORITY) {
    return "verification";
  }

  return "internal";
}

async function applyGscInformedQueueSelection(ctx: CrawlWorkerContext): Promise<void> {
  const items = await listQueueItems(ctx.run.id);
  const gscItems = items.filter((item) => isGscVisibilityQueuePriority(item.priority));
  if (gscItems.length === 0) {
    return;
  }

  const selected = selectGscInformedCrawlUrls({
    seedUrl: ctx.run.seedUrl,
    hostname: ctx.run.hostname,
    origin: ctx.origin,
    limit: ctx.run.maxPages,
    evidence: ctx.hostVariantEvidence,
    alreadyCrawledUrls: items.filter((item) => item.status === "done").map((item) => item.url),
    candidates: items
      .filter((item) => !isGscVisibilityQueuePriority(item.priority))
      .map((item) => ({
        url: item.url,
        source: inferCandidateSource(item, ctx.run.seedUrl, ctx.origin),
      })),
    gscPages: gscItems.map((item, index) => ({
      url: item.url,
      impressions: gscItems.length - index,
      clicks: 0,
    })),
  });

  for (const item of selected) {
    const alreadyQueued = items.some(
      (queued) => gscDedupeKey(queued.url, ctx.origin) === gscDedupeKey(item.url, ctx.origin),
    );
    if (alreadyQueued) {
      continue;
    }

    await enqueueUrl({
      crawlRunId: ctx.run.id,
      url: item.url,
      depth: 0,
      priority: item.reason === "gsc_visibility" ? GSC_QUEUE_PRIORITY : scorePageUrl(item.url, "internal"),
    });
    const normalized = normalizeCrawlUrl(item.url, ctx.origin);
    if (normalized) {
      ctx.discoveredUrls.add(normalized);
    }
  }

  const queued = await listQueueItems(ctx.run.id);
  for (const update of assignGscInformedQueuePriorities({
    items: queued,
    selected,
    origin: ctx.origin,
    evidence: ctx.hostVariantEvidence,
  })) {
    await updateQueueItemPriority(update.id, update.priority);
  }

  ctx.selectionLocked = true;
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

async function loadHostVariantEvidenceOrEmpty(
  websiteId: string,
  crawlRunId: string,
  origin: string,
): Promise<PageHostEvidence[]> {
  try {
    return collapseLatestPageEvidence(
      await listPageHostVariantEvidence(websiteId, { excludeCrawlRunId: crawlRunId }),
      origin,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Host-variant evidence lookup failed.";
    console.error(
      "[Crawl] Host-variant evidence unavailable; continuing without www/apex sample dedupe:",
      message,
    );
    return [];
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
  let selectionLocked = false;
  const priorEvidence = await loadHostVariantEvidenceOrEmpty(run.websiteId, run.id, origin);

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
    const enqueuePriority = selectionLocked
      ? Math.min(priority, UNSELECTED_QUEUE_PRIORITY)
      : priority;
    await enqueueUrl({
      crawlRunId: run.id,
      url: normalized,
      depth,
      priority: enqueuePriority,
    });
  };

  const ctx: CrawlWorkerContext = {
    run,
    origin,
    robotsRules: { sitemaps: [], disallow: [], allow: [] },
    discoveredUrls,
    crawledRequestedUrls: [],
    hostVariantEvidence: priorEvidence,
    finalUrlDedup,
    selectionLocked: false,
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

    await applyGscInformedQueueSelection(ctx);
    if (ctx.selectionLocked) {
      selectionLocked = true;
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
