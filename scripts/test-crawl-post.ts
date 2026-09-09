import { getSupabaseAdmin } from "../src/lib/db/supabase-admin";
import {
  createCrawlRun,
  enqueueUrl,
  getCrawlRunSummary,
  upsertWebsite,
} from "../src/lib/crawler/db/repository";
import { MAX_PAGES_PER_CRAWL } from "../src/lib/crawler/types";
import { validatePublicHttpUrl } from "../src/lib/crawler/url/normalize";

async function main() {
  const validated = validatePublicHttpUrl("https://foundfy.me");
  if (!validated) {
    throw new Error("URL normalization failed for https://foundfy.me");
  }

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

  const summary = await getCrawlRunSummary(crawlRun.id);
  const supabase = getSupabaseAdmin();
  const { data: queueRows, error: queueError } = await supabase
    .from("crawl_queue")
    .select("id, url, status, priority, depth")
    .eq("crawl_run_id", crawlRun.id);

  if (queueError) {
    throw new Error(`Failed to read crawl_queue: ${queueError.message}`);
  }

  console.log(
    JSON.stringify(
      {
        httpStatus: 201,
        responseBody: { crawlRunId: crawlRun.id },
        crawlRunId: crawlRun.id,
        crawlRunStatus: summary?.status ?? null,
        seedQueued: queueRows?.some((row) => row.url === validated.url) ?? false,
        queueRows,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
