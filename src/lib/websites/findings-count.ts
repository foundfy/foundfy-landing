import { isUsableCompletedCrawl } from "@/lib/crawler/crawl-usability";
import {
  areObservationsMaterialized,
  countActiveObservations,
  generateObservationsForCrawlRun,
} from "@/lib/observations/db/repository";

export async function loadTrustworthyFindingsCount(input: {
  crawlRunId: string;
  status: string;
  pagesCrawled: number;
}): Promise<number | null> {
  if (
    !isUsableCompletedCrawl({
      status: input.status,
      pagesCrawled: input.pagesCrawled,
    })
  ) {
    return null;
  }

  const materialized = await areObservationsMaterialized(input.crawlRunId);

  if (!materialized) {
    await generateObservationsForCrawlRun(input.crawlRunId);
  }

  return countActiveObservations(input.crawlRunId);
}
