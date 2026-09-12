import {
  createCrawlRun,
  enqueueUrl,
} from "@/lib/crawler/db/repository";
import { assertCanCreateNewCrawl } from "@/lib/crawler/daily-crawl-limit";
import { MAX_PAGES_PER_CRAWL } from "@/lib/crawler/types";

export async function createAndEnqueueCrawl(input: {
  websiteId: string;
  seedUrl: string;
}): Promise<{ crawlRunId: string; websiteId: string }> {
  await assertCanCreateNewCrawl();

  const crawlRun = await createCrawlRun({
    websiteId: input.websiteId,
    seedUrl: input.seedUrl,
    maxPages: MAX_PAGES_PER_CRAWL,
  });

  await enqueueUrl({
    crawlRunId: crawlRun.id,
    url: input.seedUrl,
    depth: 0,
    priority: 100,
  });

  return {
    crawlRunId: crawlRun.id,
    websiteId: input.websiteId,
  };
}
