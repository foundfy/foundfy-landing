import {
  createCrawlRun,
  enqueueUrl,
} from "@/lib/crawler/db/repository";
import { assertCanCreateNewCrawl } from "@/lib/crawler/daily-crawl-limit";
import {
  classifyPagePath,
  SEED_QUEUE_PRIORITY,
  VERIFICATION_QUEUE_PRIORITY,
} from "@/lib/crawler/select/page-priority";
import {
  GSC_INJECT_LIMIT,
  GSC_QUEUE_PRIORITY,
  gscDedupeKey,
} from "@/lib/crawler/select/gsc-informed-selection";
import { MAX_PAGES_PER_CRAWL } from "@/lib/crawler/types";
import { isSameSite } from "@/lib/crawler/url/normalize";

function seedHostname(seedUrl: string): string | null {
  try {
    return new URL(seedUrl).hostname;
  } catch {
    return null;
  }
}

export async function createAndEnqueueCrawl(input: {
  websiteId: string;
  seedUrl: string;
  priorityUrls?: string[];
  gscVisibilityUrls?: string[];
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

  const hostname = seedHostname(input.seedUrl);
  const seenKeys = new Set<string>();
  const seedKey = gscDedupeKey(input.seedUrl);
  if (seedKey) {
    seenKeys.add(seedKey);
  }

  const verificationLimit = Math.max(0, MAX_PAGES_PER_CRAWL - 1);
  let verificationCount = 0;

  for (const url of input.priorityUrls ?? []) {
    if (verificationCount >= verificationLimit) {
      break;
    }

    const key = gscDedupeKey(url, input.seedUrl);
    if (!key || seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    verificationCount += 1;
    await enqueueUrl({
      crawlRunId: crawlRun.id,
      url,
      depth: 0,
      priority: VERIFICATION_QUEUE_PRIORITY,
    });
  }

  let gscCount = 0;
  for (const url of input.gscVisibilityUrls ?? []) {
    if (gscCount >= GSC_INJECT_LIMIT) {
      break;
    }

    if (hostname && !isSameSite(url, hostname)) {
      continue;
    }

    if (classifyPagePath(url) === "utility") {
      continue;
    }

    const key = gscDedupeKey(url, input.seedUrl);
    if (!key || seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    gscCount += 1;
    await enqueueUrl({
      crawlRunId: crawlRun.id,
      url,
      depth: 0,
      priority: GSC_QUEUE_PRIORITY,
    });
  }

  return {
    crawlRunId: crawlRun.id,
    websiteId: input.websiteId,
  };
}
