import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import type { StoredObservation } from "@/lib/observations/types";
import type { StoredPriority } from "@/lib/priorities/types";

export function serializeFinding(
  observation: StoredObservation,
  priority: StoredPriority | null,
): AnalysisFinding {
  return {
    id: observation.id,
    ruleKey: observation.ruleKey,
    category: observation.category,
    severity: observation.severity,
    title: observation.title,
    description: observation.description,
    pageUrl: observation.pageUrl ?? null,
    evidence: observation.evidence,
    priority: priority
      ? {
          level: priority.priorityLevel,
          rank: priority.rank,
          whyItMatters: priority.whyItMatters,
          recommendedAction: priority.recommendedAction,
          verification: priority.verification,
        }
      : null,
  };
}
