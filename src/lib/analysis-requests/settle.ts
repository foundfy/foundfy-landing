import { getCrawlRunSummary } from "@/lib/crawler/db/repository";
import { ZERO_PAGE_CRAWL_FAILURE_MESSAGE } from "@/lib/crawler/crawl-usability";
import {
  findAnalysisRequestById,
  listFetchedPagesForCrawlRun,
  listOpenAnalysisRequestsForCrawlRun,
  updateActiveAnalysisRequest,
} from "./db";
import { mapRequestedUrlToFetchedPage } from "./map-fetched-page";
import type { AnalysisRequestRecord } from "./types";

const SAFE_FETCH_FAILED_COPY = "Foundfy couldn't read this page.";

function fetchFailedReason(errorMessage: string | null): string {
  if (errorMessage === ZERO_PAGE_CRAWL_FAILURE_MESSAGE) {
    return errorMessage;
  }

  return SAFE_FETCH_FAILED_COPY;
}

export async function settleAnalysisRequest(
  request: AnalysisRequestRecord,
): Promise<AnalysisRequestRecord> {
  if (request.status !== "requested" && request.status !== "running") {
    return request;
  }

  if (!request.crawlRunId) {
    return request;
  }

  const summary = await getCrawlRunSummary(request.crawlRunId);
  if (!summary || summary.status === "queued" || summary.status === "running") {
    return request;
  }

  if (summary.status === "failed" || summary.pagesCrawled === 0) {
    return applyActiveSettlement(request.id, {
      status: "fetch_failed",
      failureReason: fetchFailedReason(summary.errorMessage),
    });
  }

  const pages = await listFetchedPagesForCrawlRun(request.crawlRunId);
  const matched = mapRequestedUrlToFetchedPage(request.requestedUrl, pages);
  if (matched) {
    return applyActiveSettlement(request.id, {
      status: "analyzed",
      resultPageId: matched.id,
      failureReason: null,
    });
  }

  return applyActiveSettlement(request.id, {
    status: "fetch_failed",
    failureReason: SAFE_FETCH_FAILED_COPY,
  });
}

async function applyActiveSettlement(
  id: string,
  patch: {
    status: "analyzed" | "fetch_failed";
    resultPageId?: string | null;
    failureReason: string | null;
  },
): Promise<AnalysisRequestRecord> {
  const updated = await updateActiveAnalysisRequest(id, patch);
  if (updated) {
    return updated;
  }

  const current = await findAnalysisRequestById(id);
  if (!current) {
    throw new Error("Analysis request disappeared during settlement.");
  }

  return current;
}

export async function settleAnalysisRequestsForCrawlRun(crawlRunId: string): Promise<void> {
  const requests = await listOpenAnalysisRequestsForCrawlRun(crawlRunId);
  for (const request of requests) {
    await settleAnalysisRequest(request);
  }
}
