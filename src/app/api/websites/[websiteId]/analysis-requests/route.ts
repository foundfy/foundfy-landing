import { after } from "next/server";
import { processCrawlRun } from "@/lib/crawler/worker/process-run";
import { analysisRequestErrorResponse } from "@/lib/analysis-requests/http";
import { listAnalysisRequestsForOwner, requestPageAnalysis } from "@/lib/analysis-requests/request";
import { ANALYZE_PAGE_ERROR_COPY } from "@/lib/analysis-requests/display";
import { readObserveSessionToken } from "@/lib/gsc/cookie";
import { observeJson } from "@/lib/gsc/http";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ websiteId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { websiteId } = await context.params;
  if (!isValidUuid(websiteId)) {
    return observeJson({ error: "Invalid website id." }, 400);
  }

  try {
    const payload = await listAnalysisRequestsForOwner({
      websiteId,
      sessionToken: readObserveSessionToken(request),
    });
    return observeJson(payload);
  } catch (error) {
    return analysisRequestErrorResponse(error, ANALYZE_PAGE_ERROR_COPY);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { websiteId } = await context.params;
  if (!isValidUuid(websiteId)) {
    return observeJson({ error: "Invalid website id." }, 400);
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { decisionId?: unknown };
    if (typeof body.decisionId !== "string" || !isValidUuid(body.decisionId)) {
      return observeJson({ error: "A valid decisionId is required." }, 400);
    }

    const view = await requestPageAnalysis({
      websiteId,
      sessionToken: readObserveSessionToken(request),
      decisionId: body.decisionId,
    });

    if (
      view.crawlRunId &&
      (view.status === "requested" || view.status === "running")
    ) {
      after(async () => {
        try {
          await processCrawlRun(view.crawlRunId ?? undefined);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Analysis crawl startup failed.";
          console.error("[Analyze page] Crawl start failed:", message);
        }
      });
    }

    return observeJson(view, view.status === "requested" ? 201 : 200);
  } catch (error) {
    return analysisRequestErrorResponse(error, ANALYZE_PAGE_ERROR_COPY);
  }
}
