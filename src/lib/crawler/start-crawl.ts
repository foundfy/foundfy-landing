import {
  createCrawlRun,
  enqueueUrl,
} from "@/lib/crawler/db/repository";
import { assertCanCreateNewCrawl } from "@/lib/crawler/daily-crawl-limit";
import {
  SEED_QUEUE_PRIORITY,
  VERIFICATION_QUEUE_PRIORITY,
} from "@/lib/crawler/select/page-priority";
import { MAX_PAGES_PER_CRAWL } from "@/lib/crawler/types";

export async function createAndEnqueueCrawl(input: {
  websiteId: string;
  seedUrl: string;
  priorityUrls?: string[];
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
    priority: SEED_QUEUE_PRIORITY,
  });

  const verificationLimit = Math.max(0, MAX_PAGES_PER_CRAWL - 1);
  const seen = new Set([input.seedUrl]);

  for (const url of input.priorityUrls ?? []) {
    if (seen.size > verificationLimit) {
      break;
    }

    if (seen.has(url)) {
      continue;
    }

    seen.add(url);
    await enqueueUrl({
      crawlRunId: crawlRun.id,
      url,
      depth: 0,
      priority: VERIFICATION_QUEUE_PRIORITY,
    });
  }

  return {
    crawlRunId: crawlRun.id,
    websiteId: input.websiteId,
  };
}
