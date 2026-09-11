import { after, NextResponse } from "next/server";
import { createAndEnqueueCrawl } from "@/lib/crawler/start-crawl";
import { validatePublicHttpUrl } from "@/lib/crawler/url/normalize";
import { processCrawlRun } from "@/lib/crawler/worker/process-run";
import { findActiveCrawlRunForWebsite, getWebsiteById } from "@/lib/websites/repository";
import { resolveRescanSeedUrl } from "@/lib/websites/rescan-seed";
import { isValidUuid } from "@/lib/websites/uuid";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ websiteId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { websiteId } = await context.params;

  if (!isValidUuid(websiteId)) {
    return NextResponse.json({ error: "Invalid website id." }, { status: 400 });
  }

  try {
    const website = await getWebsiteById(websiteId);
    if (!website) {
      return NextResponse.json({ error: "Website not found." }, { status: 404 });
    }

    const activeScan = await findActiveCrawlRunForWebsite(websiteId);
    if (activeScan) {
      return NextResponse.json(
        {
          crawlRunId: activeScan.id,
          websiteId,
          reusedActiveScan: true,
        },
        { status: 200 },
      );
    }

    const seedUrl = await resolveRescanSeedUrl(website);
    const validated = validatePublicHttpUrl(seedUrl);
    if (!validated) {
      return NextResponse.json(
        { error: "Unable to resolve a valid seed URL for this website." },
        { status: 500 },
      );
    }

    const started = await createAndEnqueueCrawl({
      websiteId,
      seedUrl: validated.url,
    });

    after(async () => {
      try {
        await processCrawlRun(started.crawlRunId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Background crawl failed.";
        console.error("[Website Scan] Background processing failed:", message);
      }
    });

    return NextResponse.json(
      {
        crawlRunId: started.crawlRunId,
        websiteId: started.websiteId,
        reusedActiveScan: false,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scan startup error";
    console.error("[Website Scan] Failed to start scan:", message);
    return NextResponse.json(
      { error: "Unable to start scan right now. Please try again." },
      { status: 500 },
    );
  }
}
