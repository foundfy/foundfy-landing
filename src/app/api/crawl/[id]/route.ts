import { after, NextResponse } from "next/server";
import {
  isUsableCompletedCrawl,
  normalizeCrawlStatusForApiResponse,
} from "@/lib/crawler/crawl-usability";
import { getCrawlRunSummary } from "@/lib/crawler/db/repository";
import { maybeRecoverStaleCrawlRun } from "@/lib/crawler/worker/recover-stale-run";
import { processCrawlRun } from "@/lib/crawler/worker/process-run";
import { scheduleExplanationEnrichmentIfNeeded } from "@/lib/ai-enrichment/scheduler";
import { loadCompletedCrawlResults } from "@/lib/findings/load-completed-results";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid crawl run id." }, { status: 400 });
  }

  try {
    let summary = await getCrawlRunSummary(id);

    if (!summary) {
      return NextResponse.json({ error: "Crawl run not found." }, { status: 404 });
    }

    const recovery = await maybeRecoverStaleCrawlRun(id);

    if (recovery.recovered) {
      summary = (await getCrawlRunSummary(id)) ?? summary;
    }

    if (recovery.recovered || summary.status === "queued") {
      after(async () => {
        try {
          await processCrawlRun(id);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Status poll recovery failed.";
          console.error("[Crawl] Queued run recovery failed:", message);
        }
      });
    }

    let completedFindings;
    if (isUsableCompletedCrawl(summary)) {
      try {
        completedFindings = await loadCompletedCrawlResults(id);
      } catch (error) {
        console.error("[Crawl] Failed to load completed crawl results:", error);
      }
    }

    if (completedFindings) {
      after(async () => {
        try {
          await scheduleExplanationEnrichmentIfNeeded({
            crawlRunId: id,
            hostname: summary.hostname,
            pagesCrawled: summary.pagesCrawled,
            findings: completedFindings.findings,
            findingsSummary: completedFindings.findingsSummary,
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Explanation enrichment scheduling failed.";
          console.error("[AI Enrichment] Async scheduling failed:", message);
        }
      });
    }

    const responseSummary = normalizeCrawlStatusForApiResponse(summary);

    return NextResponse.json(
      {
        id: responseSummary.id,
        websiteId: responseSummary.websiteId,
        status: responseSummary.status,
        hostname: responseSummary.hostname,
        seedUrl: responseSummary.seedUrl,
        maxPages: responseSummary.maxPages,
        pagesCrawled: responseSummary.pagesCrawled,
        pagesDiscovered: responseSummary.pagesDiscovered,
        errorMessage: responseSummary.errorMessage,
        startedAt: responseSummary.startedAt,
        completedAt: responseSummary.completedAt,
        createdAt: responseSummary.createdAt,
        findings: completedFindings?.findings,
        findingsSummary: completedFindings?.findingsSummary,
        comparison: completedFindings?.comparison,
        searchPresence: completedFindings?.searchPresence,
        explanationEnrichmentStatus:
          completedFindings?.explanationEnrichmentStatus,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("[Crawl] Failed to fetch crawl status:", error);
    return NextResponse.json(
      { error: "Unable to fetch crawl status right now." },
      { status: 500 },
    );
  }
}
