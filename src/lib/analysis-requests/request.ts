import { isDailyCrawlLimitReachedError } from "@/lib/crawler/daily-crawl-limit";
import { listQueueItems } from "@/lib/crawler/db/repository";
import { resolveOwnerGscVisibilityPages } from "@/lib/crawler/select/gsc-visibility";
import {
  InvalidRequiredCrawlUrlError,
  resolveActiveCrawlForRequiredUrl,
  resolveRequiredCrawlUrl,
} from "@/lib/crawler/select/required-url";
import { createAndEnqueueCrawl } from "@/lib/crawler/start-crawl";
import { staleReasonForRun } from "@/lib/decisions/load";
import { findDecisionById, findLatestCompletedDecisionRun } from "@/lib/decisions/db";
import { loadDecisionPrerequisites } from "@/lib/decisions/generate";
import { DecisionPrerequisiteError } from "@/lib/decisions/types";
import { listEvidenceForSync } from "@/lib/gsc/db-search";
import { requireObserveOwner } from "@/lib/gsc/observe";
import { pageComparisonKey } from "@/lib/gsc/page-map";
import { findActiveCrawlRunForWebsite, findLatestUsableCrawlRun } from "@/lib/websites/repository";
import { resolveRescanPriorityUrls } from "@/lib/websites/rescan-priority-urls";
import { resolveRescanSeedUrl } from "@/lib/websites/rescan-seed";
import {
  findActiveAnalysisRequest,
  insertAnalysisRequest,
  listAnalysisRequestsForWebsite,
  listFetchedPagesForCrawlRun,
  toAnalysisRequestView,
} from "./db";
import { mapRequestedUrlToFetchedPage } from "./map-fetched-page";
import { settleAnalysisRequest } from "./settle";
import {
  AnalysisRequestError,
  type AnalysisRequestRecord,
  type AnalysisRequestView,
} from "./types";

function currentGscHasUrl(urls: Array<string | null | undefined>, requestedUrl: string): boolean {
  const requestedKey = pageComparisonKey(requestedUrl);
  if (!requestedKey) {
    return false;
  }

  return urls.some((url) => Boolean(url && pageComparisonKey(url) === requestedKey));
}

async function markAnalyzed(input: {
  websiteId: string;
  ownerId: string;
  decisionId: string;
  decisionRunId: string | null;
  gscSyncId: string | null;
  requestedUrl: string;
  requestedUrlKey: string;
  crawlRunId: string;
  resultPageId: string;
}): Promise<AnalysisRequestRecord> {
  const active = await findActiveAnalysisRequest({
    websiteId: input.websiteId,
    requestedUrlKey: input.requestedUrlKey,
  });
  if (active) {
    return settleAnalysisRequest(active);
  }

  return insertAnalysisRequest({
    websiteId: input.websiteId,
    decisionId: input.decisionId,
    decisionRunId: input.decisionRunId,
    gscSyncId: input.gscSyncId,
    requestedUrl: input.requestedUrl,
    requestedUrlKey: input.requestedUrlKey,
    requestedBy: input.ownerId,
    crawlRunId: input.crawlRunId,
    resultPageId: input.resultPageId,
    status: "analyzed",
  });
}

export async function listAnalysisRequestsForOwner(input: {
  websiteId: string;
  sessionToken: string | null;
}): Promise<{ requests: AnalysisRequestView[] }> {
  await requireObserveOwner(input);
  const records = await listAnalysisRequestsForWebsite(input.websiteId);
  const settled: AnalysisRequestRecord[] = [];
  for (const record of records) {
    settled.push(await settleAnalysisRequest(record));
  }

  return { requests: settled.map(toAnalysisRequestView) };
}

export async function requestPageAnalysis(input: {
  websiteId: string;
  sessionToken: string | null;
  decisionId: string;
}): Promise<AnalysisRequestView> {
  const context = await requireObserveOwner(input);
  const decision = await findDecisionById(input.websiteId, input.decisionId);
  if (!decision) {
    throw new AnalysisRequestError("not_found", "Decision not found.", 404);
  }

  if (decision.decisionType !== "inspect_unanalyzed_page" || decision.pageId != null) {
    throw new AnalysisRequestError(
      "unsupported_decision",
      "Foundfy can only analyze a current Google-visible page that is not in the latest sample.",
    );
  }

  if (!decision.pageUrl) {
    throw new AnalysisRequestError("invalid_url", "This Decision does not include a page URL.");
  }

  const requiredUrl = resolveRequiredCrawlUrl({
    requiredUrl: decision.pageUrl,
    seedUrl: context.website.displayUrl || `https://${context.website.hostname}`,
    hostname: context.website.hostname,
  });
  if (!requiredUrl) {
    throw new AnalysisRequestError(
      "invalid_url",
      "This page is not safe for Foundfy to fetch.",
    );
  }

  const requestedUrlKey = pageComparisonKey(requiredUrl);
  if (!requestedUrlKey || pageComparisonKey(decision.pageUrl) !== requestedUrlKey) {
    throw new AnalysisRequestError("invalid_url", "This page is not safe for Foundfy to fetch.");
  }

  const latestCrawl = await findLatestUsableCrawlRun(input.websiteId);
  if (latestCrawl) {
    const fetched = mapRequestedUrlToFetchedPage(
      requiredUrl,
      await listFetchedPagesForCrawlRun(latestCrawl.id),
    );
    if (fetched) {
      return toAnalysisRequestView(
        await markAnalyzed({
          websiteId: input.websiteId,
          ownerId: context.owner.id,
          decisionId: decision.id,
          decisionRunId: decision.decisionRunId,
          gscSyncId: null,
          requestedUrl: requiredUrl,
          requestedUrlKey,
          crawlRunId: latestCrawl.id,
          resultPageId: fetched.id,
        }),
      );
    }
  }

  const active = await findActiveAnalysisRequest({
    websiteId: input.websiteId,
    requestedUrlKey,
  });
  if (active) {
    return toAnalysisRequestView(await settleAnalysisRequest(active));
  }

  let prerequisites: Awaited<ReturnType<typeof loadDecisionPrerequisites>>;
  try {
    prerequisites = await loadDecisionPrerequisites(input);
  } catch (error) {
    if (error instanceof DecisionPrerequisiteError) {
      throw new AnalysisRequestError(
        error.reason === "missing_gsc_sync" || error.reason === "google_not_connected"
          ? "missing_gsc_evidence"
          : "decision_stale",
        error.message,
      );
    }
    throw error;
  }

  const run = await findLatestCompletedDecisionRun(input.websiteId);
  const stale =
    run == null
      ? "missing_run"
      : staleReasonForRun({
          run,
          siteModelId: prerequisites.siteModel.id,
          crawlRunId: prerequisites.crawl.id,
          gscSearchSyncId: prerequisites.sync.id,
          goal: prerequisites.goal,
        });

  if (!run || stale || decision.decisionRunId !== run.id) {
    throw new AnalysisRequestError(
      "decision_stale",
      "This Decision is no longer current. Refresh priorities before analyzing this page.",
    );
  }

  const gscRows = await listEvidenceForSync(prerequisites.sync.id);
  const gscUrls = gscRows
    .filter((row) => row.evidenceType === "page")
    .map((row) => row.pageUrl);
  if (!currentGscHasUrl(gscUrls, requiredUrl)) {
    throw new AnalysisRequestError(
      "missing_gsc_evidence",
      "Foundfy no longer has current Google Search evidence for this page.",
    );
  }

  const activeCrawl = await findActiveCrawlRunForWebsite(input.websiteId);
  if (activeCrawl) {
    const queueItems = await listQueueItems(activeCrawl.id);
    const fetchedPages = await listFetchedPagesForCrawlRun(activeCrawl.id);
    const includedUrls = [
      ...queueItems.map((item) => item.url),
      ...fetchedPages.flatMap((page) => [page.requestedUrl, page.finalUrl]),
    ];
    const reuse = resolveActiveCrawlForRequiredUrl({
      activeRunId: activeCrawl.id,
      requiredUrl,
      seedUrl: activeCrawl.seedUrl,
      hostname: context.website.hostname,
      origin: activeCrawl.seedUrl,
      queueItems: includedUrls.map((url) => ({ url })),
    });

    if (reuse.action === "unavailable") {
      return toAnalysisRequestView(
        await insertAnalysisRequest({
          websiteId: input.websiteId,
          decisionId: decision.id,
          decisionRunId: run.id,
          gscSyncId: prerequisites.sync.id,
          requestedUrl: requiredUrl,
          requestedUrlKey,
          requestedBy: context.owner.id,
          crawlRunId: null,
          status: "blocked",
          failureReason: "scan_already_running",
        }),
      );
    }

    return toAnalysisRequestView(
      await insertAnalysisRequest({
        websiteId: input.websiteId,
        decisionId: decision.id,
        decisionRunId: run.id,
        gscSyncId: prerequisites.sync.id,
        requestedUrl: requiredUrl,
        requestedUrlKey,
        requestedBy: context.owner.id,
        crawlRunId: activeCrawl.id,
        status: activeCrawl.status === "queued" ? "requested" : "running",
      }),
    );
  }

  const seedUrl = await resolveRescanSeedUrl(context.website);
  const priorityUrls = await resolveRescanPriorityUrls(context.website, seedUrl);
  const gscVisibilityUrls = (
    await resolveOwnerGscVisibilityPages({
      websiteId: input.websiteId,
      hostname: context.website.hostname,
      sessionToken: input.sessionToken,
    })
  ).map((page) => page.url);

  let started: { crawlRunId: string; websiteId: string };
  try {
    started = await createAndEnqueueCrawl({
      websiteId: input.websiteId,
      seedUrl,
      priorityUrls,
      requiredUrl,
      ...(gscVisibilityUrls.length > 0 ? { gscVisibilityUrls } : {}),
    });
  } catch (error) {
    if (error instanceof InvalidRequiredCrawlUrlError) {
      throw new AnalysisRequestError("invalid_url", error.message);
    }
    if (isDailyCrawlLimitReachedError(error)) {
      throw error;
    }
    throw error;
  }

  return toAnalysisRequestView(
    await insertAnalysisRequest({
      websiteId: input.websiteId,
      decisionId: decision.id,
      decisionRunId: run.id,
      gscSyncId: prerequisites.sync.id,
      requestedUrl: requiredUrl,
      requestedUrlKey,
      requestedBy: context.owner.id,
      crawlRunId: started.crawlRunId,
      status: "requested",
    }),
  );
}
