import {
  loadCrawlEvidenceContext,
  listObservations,
} from "@/lib/observations/db/repository";
import type { StoredObservation } from "@/lib/observations/types";
import { buildComparisonKey } from "./comparison-key";
import { buildCrawlCoverage } from "./crawl-coverage";
import { findPreviousCompletedCrawlRun } from "./previous-crawl";
import type {
  CrawlComparison,
  CrawlCoverage,
  CrawlComparisonSummary,
  FindingChangeStatus,
  FixedFindingSnapshot,
} from "./types";
import { hasSufficientVerificationCoverage } from "./verification";

export type CompareObservationsInput = {
  previousObservations: StoredObservation[];
  currentObservations: StoredObservation[];
  coverage: CrawlCoverage;
  previousCrawlRunId: string;
  previousCompletedAt: string;
};

export type CompareObservationsResult = {
  comparison: CrawlComparison;
  changeStatusByObservationId: Map<string, FindingChangeStatus>;
};

function indexObservationsByComparisonKey(
  observations: StoredObservation[],
): Map<string, StoredObservation> {
  const index = new Map<string, StoredObservation>();

  for (const observation of observations) {
    index.set(buildComparisonKey(observation), observation);
  }

  return index;
}

export function compareObservations(
  input: CompareObservationsInput,
): CompareObservationsResult {
  const previousByKey = indexObservationsByComparisonKey(input.previousObservations);
  const currentByKey = indexObservationsByComparisonKey(input.currentObservations);
  const changeStatusByObservationId = new Map<string, FindingChangeStatus>();
  const fixedFindings: FixedFindingSnapshot[] = [];

  let stillPresent = 0;
  let newCount = 0;
  let fixed = 0;
  let unverified = 0;

  for (const [key, currentObservation] of currentByKey) {
    if (previousByKey.has(key)) {
      stillPresent += 1;
      changeStatusByObservationId.set(currentObservation.id, "still_present");
    } else {
      newCount += 1;
      changeStatusByObservationId.set(currentObservation.id, "new");
    }
  }

  for (const [key, previousObservation] of previousByKey) {
    if (currentByKey.has(key)) {
      continue;
    }

    if (
      hasSufficientVerificationCoverage(previousObservation, input.coverage)
    ) {
      fixed += 1;
      fixedFindings.push({
        ruleKey: previousObservation.ruleKey,
        title: previousObservation.title,
        pageUrl: previousObservation.pageUrl ?? null,
      });
      continue;
    }

    unverified += 1;
  }

  const summary: CrawlComparisonSummary = {
    previousCrawlRunId: input.previousCrawlRunId,
    previousCompletedAt: input.previousCompletedAt,
    fixed,
    stillPresent,
    new: newCount,
    unverified,
  };

  return {
    comparison: {
      ...summary,
      fixedFindings,
    },
    changeStatusByObservationId,
  };
}

export async function compareWithPreviousCrawl(
  crawlRunId: string,
): Promise<CompareObservationsResult | null> {
  const context = await loadCrawlEvidenceContext(crawlRunId);
  if (!context) {
    return null;
  }

  const previousRun = await findPreviousCompletedCrawlRun({
    websiteId: context.websiteId,
    currentCrawlRunId: crawlRunId,
  });

  if (!previousRun) {
    return null;
  }

  const [previousObservations, currentObservations] = await Promise.all([
    listObservations(previousRun.id),
    listObservations(crawlRunId),
  ]);

  const coverage = buildCrawlCoverage(context);

  return compareObservations({
    previousObservations,
    currentObservations,
    coverage,
    previousCrawlRunId: previousRun.id,
    previousCompletedAt: previousRun.completedAt,
  });
}
