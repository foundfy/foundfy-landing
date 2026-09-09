import {
  generateObservationsForCrawlRun,
  listObservations,
} from "../db/repository";
import { serializeObservation } from "./serialize";
import type { AnalysisObservation } from "@/lib/analysis/crawl-status";

export async function loadObservationsForCompletedRun(
  crawlRunId: string,
): Promise<AnalysisObservation[]> {
  let observations = await listObservations(crawlRunId);

  if (observations.length === 0) {
    const generated = await generateObservationsForCrawlRun(crawlRunId);
    observations = generated.observations;
  }

  return observations.map(serializeObservation);
}
