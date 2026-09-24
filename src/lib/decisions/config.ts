export const DECISION_ENGINE_VERSION = "decision_v1" as const;
export const DECISION_MAX_COUNT = 5;
export const DECISION_TYPE_B_MIN_SHARE = 0.1;

export const ISSUE_IMPORTANCE_BY_LEVEL = {
  critical: 100,
  high: 80,
  medium: 55,
  low: 30,
} as const;

export const ISSUE_IMPORTANCE_BY_SEVERITY = {
  error: 80,
  warning: 55,
  info: 25,
} as const;
