import type { PriorityLevel } from "../types";

export const PRIORITY_WEIGHTS = {
  impact: 0.5,
  reach: 0.3,
  confidence: 0.2,
} as const;

export function calculatePriorityScore(input: {
  impact: number;
  reach: number;
  confidence: number;
}): number {
  const raw =
    input.impact * PRIORITY_WEIGHTS.impact +
    input.reach * PRIORITY_WEIGHTS.reach +
    input.confidence * PRIORITY_WEIGHTS.confidence;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function mapScoreToPriorityLevel(score: number): PriorityLevel {
  if (score >= 80) {
    return "critical";
  }

  if (score >= 60) {
    return "high";
  }

  if (score >= 35) {
    return "medium";
  }

  return "low";
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
