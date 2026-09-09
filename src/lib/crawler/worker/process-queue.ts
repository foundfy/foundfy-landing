import { processCrawlRun } from "./process-run";
import { reclaimStaleCrawlRuns } from "./reclaim-stale";

export async function processCrawlQueue(input?: {
  preferredRunId?: string;
  maxRuns?: number;
}): Promise<{
  reclaimed: Awaited<ReturnType<typeof reclaimStaleCrawlRuns>>;
  processedRunIds: string[];
}> {
  const reclaimed = await reclaimStaleCrawlRuns();
  const processedRunIds: string[] = [];
  const maxRuns = input?.maxRuns ?? (input?.preferredRunId ? 1 : 3);

  if (input?.preferredRunId) {
    const processedRunId = await processCrawlRun(input.preferredRunId);
    if (processedRunId) {
      processedRunIds.push(processedRunId);
    }

    return { reclaimed, processedRunIds };
  }

  for (let index = 0; index < maxRuns; index += 1) {
    const processedRunId = await processCrawlRun();
    if (!processedRunId) {
      break;
    }

    processedRunIds.push(processedRunId);
  }

  return { reclaimed, processedRunIds };
}
