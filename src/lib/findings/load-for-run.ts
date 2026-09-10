import type {
  AnalysisFinding,
  FindingsSummary,
} from "@/lib/analysis/crawl-status";
import {
  generateObservationsForCrawlRun,
  listObservations,
} from "@/lib/observations/db/repository";
import {
  generatePrioritiesForCrawlRun,
  listPriorities,
} from "@/lib/priorities/db/repository";
import type { StoredPriority } from "@/lib/priorities/types";
import { applyGroupedRecommendations } from "@/lib/recommendations";
import {
  selectHighlightGroups,
  toHighlightGroupSummaries,
} from "./highlight-groups";
import { sortFindings } from "./order";
import { serializeFinding } from "./serialize";

function buildPriorityMap(
  priorities: StoredPriority[],
): Map<string, StoredPriority> {
  return new Map(priorities.map((priority) => [priority.observationId, priority]));
}

async function loadPriorityMap(
  crawlRunId: string,
  observationIds: string[],
): Promise<Map<string, StoredPriority>> {
  let priorities = await listPriorities(crawlRunId);

  if (priorities.length === 0 && observationIds.length > 0) {
    await generatePrioritiesForCrawlRun(crawlRunId);
    priorities = await listPriorities(crawlRunId);
  }

  let priorityMap = buildPriorityMap(priorities);
  const missingObservationIds = observationIds.filter(
    (observationId) => !priorityMap.has(observationId),
  );

  if (missingObservationIds.length > 0) {
    await generatePrioritiesForCrawlRun(crawlRunId);
    priorities = await listPriorities(crawlRunId);
    priorityMap = buildPriorityMap(priorities);
  }

  return priorityMap;
}

export async function loadFindingsForCompletedRun(crawlRunId: string): Promise<{
  findings: AnalysisFinding[];
  findingsSummary: FindingsSummary;
}> {
  let observations = await listObservations(crawlRunId);

  if (observations.length === 0) {
    const generated = await generateObservationsForCrawlRun(crawlRunId);
    observations = generated.observations;
  }

  const priorityMap = await loadPriorityMap(
    crawlRunId,
    observations.map((observation) => observation.id),
  );

  const serializedFindings = sortFindings(
    observations.map((observation) =>
      serializeFinding(observation, priorityMap.get(observation.id) ?? null),
    ),
  );

  const highlightGroups = selectHighlightGroups(serializedFindings);
  const findings = applyGroupedRecommendations(serializedFindings, highlightGroups);

  return {
    findings,
    findingsSummary: {
      totalCount: findings.length,
      highlightedFindingIds: highlightGroups.map(
        (group) => group.representativeFindingId,
      ),
      highlightGroups: toHighlightGroupSummaries(highlightGroups),
    },
  };
}
