import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import type { StoredObservation } from "@/lib/observations/types";
import type { StoredPriority } from "@/lib/priorities/types";
import { buildFindingRecommendation } from "@/lib/recommendations";

export function serializeFinding(
  observation: StoredObservation,
  priority: StoredPriority | null,
): AnalysisFinding {
  const findingPriority = priority
    ? {
        level: priority.priorityLevel,
        rank: priority.rank,
        whyItMatters: priority.whyItMatters,
        recommendedAction: priority.recommendedAction,
        verification: priority.verification,
      }
    : null;

  return {
    id: observation.id,
    ruleKey: observation.ruleKey,
    category: observation.category,
    severity: observation.severity,
    title: observation.title,
    description: observation.description,
    pageUrl: observation.pageUrl ?? null,
    evidence: observation.evidence,
    priority: findingPriority,
    recommendation: buildFindingRecommendation({
      ruleKey: observation.ruleKey,
      pageUrl: observation.pageUrl ?? null,
      evidence: observation.evidence,
      priorityLevel: findingPriority?.level ?? null,
    }),
  };
}
