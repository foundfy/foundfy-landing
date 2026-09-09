import type { StoredObservation } from "../types";
import type { AnalysisObservation } from "@/lib/analysis/crawl-status";

export function serializeObservation(
  observation: StoredObservation,
): AnalysisObservation {
  return {
    id: observation.id,
    ruleKey: observation.ruleKey,
    category: observation.category,
    severity: observation.severity,
    title: observation.title,
    description: observation.description,
    pageUrl: observation.pageUrl ?? null,
    evidence: observation.evidence,
  };
}
