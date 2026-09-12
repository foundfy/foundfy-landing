import { NextResponse } from "next/server";
import { upsertWebsite } from "@/lib/crawler/db/repository";
import {
  DAILY_CRAWL_LIMIT_STATUS,
  isDailyCrawlLimitReachedError,
} from "@/lib/crawler/daily-crawl-limit";
import { createAndEnqueueCrawl } from "@/lib/crawler/start-crawl";
import { validatePublicHttpUrl } from "@/lib/crawler/url/normalize";

export const runtime = "nodejs";

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

    return NextResponse.json(
      { crawlRunId: started.crawlRunId, websiteId: started.websiteId },
      { status: 201 },
    );
  } catch (error) {
    if (isDailyCrawlLimitReachedError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: DAILY_CRAWL_LIMIT_STATUS },
      );
    }

    const message = error instanceof Error ? error.message : "Unknown crawl startup error";
    console.error("[Crawl] Failed to create crawl run:", message);
    return NextResponse.json(
      { error: "Unable to start crawl right now. Please try again." },
      { status: 500 },
    );
  }
}
