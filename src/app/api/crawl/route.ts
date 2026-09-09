import { NextResponse } from "next/server";
import {
  createCrawlRun,
  enqueueUrl,
  upsertWebsite,
} from "@/lib/crawler/db/repository";
import { MAX_PAGES_PER_CRAWL } from "@/lib/crawler/types";
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
    const crawlRun = await createCrawlRun({
      websiteId: website.id,
      seedUrl: validated.url,
      maxPages: MAX_PAGES_PER_CRAWL,
    });

    await enqueueUrl({
      crawlRunId: crawlRun.id,
      url: validated.url,
      depth: 0,
      priority: 100,
    });

    return NextResponse.json({ crawlRunId: crawlRun.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown crawl startup error";
    console.error("[Crawl] Failed to create crawl run:", message);
    return NextResponse.json(
      { error: "Unable to start crawl right now. Please try again." },
      { status: 500 },
    );
  }
}
