import { after, NextResponse } from "next/server";
import { upsertWebsite } from "@/lib/crawler/db/repository";
import { createAndEnqueueCrawl } from "@/lib/crawler/start-crawl";
import { validatePublicHttpUrl } from "@/lib/crawler/url/normalize";
import { processCrawlRun } from "@/lib/crawler/worker/process-run";

export const runtime = "nodejs";
export const maxDuration = 60;

type CrawlRequestBody = {
  url?: string;
};

export async function POST(request: Request) {
  let body: CrawlRequestBody;

  try {
    body = (await request.json()) as CrawlRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validated = validatePublicHttpUrl(body.url ?? "");
  if (!validated) {
    return NextResponse.json(
      { error: "Enter a valid public website URL, such as example.com." },
      { status: 400 },
    );
  }

  try {
    const website = await upsertWebsite(validated.url, validated.hostname);
    const started = await createAndEnqueueCrawl({
      websiteId: website.id,
      seedUrl: validated.url,
    });

    after(async () => {
      try {
        await processCrawlRun(started.crawlRunId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Background crawl failed.";
        console.error("[Crawl] Background processing failed:", message);
      }
    });

    return NextResponse.json(
      { crawlRunId: started.crawlRunId, websiteId: started.websiteId },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown crawl startup error";
    console.error("[Crawl] Failed to create crawl run:", message);
    return NextResponse.json(
      { error: "Unable to start crawl right now. Please try again." },
      { status: 500 },
    );
  }
}
