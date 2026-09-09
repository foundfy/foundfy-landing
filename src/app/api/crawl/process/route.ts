import { NextResponse } from "next/server";
import { isCrawlWorkerAuthorized } from "@/lib/crawler/worker/auth";
import { processCrawlQueue } from "@/lib/crawler/worker/process-queue";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCrawlWorkerAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const preferredRunId = url.searchParams.get("runId") ?? undefined;

  try {
    const result = await processCrawlQueue({
      preferredRunId,
      maxRuns: preferredRunId ? 1 : 3,
    });

    return NextResponse.json({
      ok: true,
      processedRunIds: result.processedRunIds,
      reclaimed: result.reclaimed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crawl worker failed.";
    console.error("[Crawl Worker] Processing failed:", message);
    return NextResponse.json({ error: "Crawl worker failed." }, { status: 500 });
  }
}
