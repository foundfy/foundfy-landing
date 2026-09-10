import type { RuleKey } from "@/lib/observations/types";
import { getPriorityCeiling } from "../config/priority-ceilings";
import type { PriorityLevel } from "../types";
import { mapScoreToPriorityLevel } from "./formula";

export const PRIORITY_LEVEL_MAX_SCORE: Record<PriorityLevel, number> = {
  critical: 100,
  high: 79,
  medium: 59,
  low: 34,
};

export function applyPriorityCeiling(input: {
  rawScore: number;
  ruleKey: RuleKey;
}): {
  rawPriorityScore: number;
  priorityScore: number;
  priorityLevel: PriorityLevel;
  priorityCeiling: PriorityLevel | null;
} {
  const rawPriorityScore = input.rawScore;
  const priorityCeiling = getPriorityCeiling(input.ruleKey);

  if (!priorityCeiling) {
    return {
      rawPriorityScore,
      priorityScore: rawPriorityScore,
      priorityLevel: mapScoreToPriorityLevel(rawPriorityScore),
      priorityCeiling: null,
    };
  }

  const priorityScore = Math.min(
    rawPriorityScore,
    PRIORITY_LEVEL_MAX_SCORE[priorityCeiling],
  );

  return {
    rawPriorityScore,
    priorityScore,
    priorityLevel: mapScoreToPriorityLevel(priorityScore),
    priorityCeiling,
  };
}
