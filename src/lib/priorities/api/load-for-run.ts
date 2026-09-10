import {
  generatePrioritiesForCrawlRun,
  listPriorities,
} from "../db/repository";

export async function loadPrioritiesForCompletedRun(crawlRunId: string) {
  let priorities = await listPriorities(crawlRunId);

  if (priorities.length === 0) {
    const generated = await generatePrioritiesForCrawlRun(crawlRunId);
    priorities = generated.priorities;
  }

  return priorities;
}
