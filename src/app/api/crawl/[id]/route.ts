import { NextResponse } from "next/server";
import { getCrawlRunSummary } from "@/lib/crawler/db/repository";

export const runtime = "nodejs";

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
    const summary = await getCrawlRunSummary(id);

    if (!summary) {
      return NextResponse.json({ error: "Crawl run not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: summary.id,
      status: summary.status,
      hostname: summary.hostname,
      seedUrl: summary.seedUrl,
      maxPages: summary.maxPages,
      pagesCrawled: summary.pagesCrawled,
      pagesDiscovered: summary.pagesDiscovered,
      errorMessage: summary.errorMessage,
      startedAt: summary.startedAt,
      completedAt: summary.completedAt,
      createdAt: summary.createdAt,
    });
  } catch (error) {
    console.error("[Crawl] Failed to fetch crawl status:", error);
    return NextResponse.json(
      { error: "Unable to fetch crawl status right now." },
      { status: 500 },
    );
  }
}
