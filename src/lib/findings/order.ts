import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import type { ObservationSeverity } from "@/lib/observations/types";

const SEVERITY_WEIGHT: Record<ObservationSeverity, number> = {
  error: 3,
  warning: 2,
  info: 1,
};

function compareUnprioritisedFindings(
  left: AnalysisFinding,
  right: AnalysisFinding,
): number {
  const severityDelta =
    SEVERITY_WEIGHT[right.severity] - SEVERITY_WEIGHT[left.severity];

  if (severityDelta !== 0) {
    return severityDelta;
  }

  const ruleCompare = left.ruleKey.localeCompare(right.ruleKey);
  if (ruleCompare !== 0) {
    return ruleCompare;
  }

  return left.id.localeCompare(right.id);
}

export function compareFindings(
  left: AnalysisFinding,
  right: AnalysisFinding,
): number {
  const leftRank = left.priority?.rank;
  const rightRank = right.priority?.rank;

  if (leftRank !== undefined && rightRank !== undefined) {
    return leftRank - rightRank;
  }

  if (leftRank !== undefined) {
    return -1;
  }

  if (rightRank !== undefined) {
    return 1;
  }

  return compareUnprioritisedFindings(left, right);
}

export function sortFindings(findings: AnalysisFinding[]): AnalysisFinding[] {
  return [...findings].sort(compareFindings);
}
