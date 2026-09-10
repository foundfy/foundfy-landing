import type { ObservationSeverity } from "@/lib/observations/types";
import type { PriorityDraft } from "../types";

const SEVERITY_WEIGHT: Record<ObservationSeverity, number> = {
  error: 3,
  warning: 2,
  info: 1,
};

export function comparePriorityDrafts(
  left: PriorityDraft & { severity: ObservationSeverity },
  right: PriorityDraft & { severity: ObservationSeverity },
): number {
  if (right.priorityScore !== left.priorityScore) {
    return right.priorityScore - left.priorityScore;
  }

  const severityDelta =
    SEVERITY_WEIGHT[right.severity] - SEVERITY_WEIGHT[left.severity];

  if (severityDelta !== 0) {
    return severityDelta;
  }

  const ruleCompare = left.ruleKey.localeCompare(right.ruleKey);
  if (ruleCompare !== 0) {
    return ruleCompare;
  }

  return left.subjectKey.localeCompare(right.subjectKey);
}

export function assignRanks<T extends PriorityDraft>(drafts: T[]): T[] {
  const sorted = [...drafts].sort((left, right) => {
    if (right.priorityScore !== left.priorityScore) {
      return right.priorityScore - left.priorityScore;
    }

    const ruleCompare = left.ruleKey.localeCompare(right.ruleKey);
    if (ruleCompare !== 0) {
      return ruleCompare;
    }

    return left.subjectKey.localeCompare(right.subjectKey);
  });

  return sorted.map((draft, index) => ({
    ...draft,
    rank: index + 1,
  }));
}
