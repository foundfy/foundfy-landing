import type { WebsiteGoalType } from "@/lib/goals/types";
import type { ObservationSeverity, RuleKey } from "@/lib/observations/types";
import type { PriorityLevel } from "@/lib/priorities/types";

export const DECISION_TYPES = [
  "existing_demand_page_issue",
  "inspect_unanalyzed_page",
  "multi_page_issue_with_visibility",
] as const;

export type DecisionType = (typeof DECISION_TYPES)[number];

export type DecisionPriorityBand = "do_first" | "next" | "later";

export type DecisionConfidence = "exact_match" | "bounded_dataset" | "unmapped_page";

export type DecisionRunStatus = "running" | "completed" | "failed" | "stale";

export type GoalSnapshot = {
  id: string;
  primaryType: WebsiteGoalType;
  secondaryType: WebsiteGoalType | null;
  note: string | null;
  updatedAt: string;
};

export type DecisionScoring = {
  issueImportance: number;
  searchDemand: number;
  evidenceConfidence: number;
  total: number;
};

export type DecisionEvidenceKind =
  | "observation"
  | "gsc_evidence"
  | "page"
  | "crawl_run"
  | "gsc_sync"
  | "site_model"
  | "goal";

export type DecisionEvidenceRef = {
  kind: DecisionEvidenceKind;
  recordId: string;
  snapshot: Record<string, unknown>;
};

export type DecisionEngineInput = {
  websiteId: string;
  siteModelId: string;
  crawlRunId: string;
  gscSearchSyncId: string;
  engineVersion: "decision_v1";
  goal: GoalSnapshot;
  gscTruncated: boolean;
  periodStart: string;
  periodEnd: string;
};

export type GscPageEvidenceInput = {
  id: string;
  pageUrl: string;
  pageId: string | null;
  clicks: number;
  impressions: number;
};

export type ObservationInput = {
  id: string;
  pageId: string | null;
  pageUrl: string | null;
  ruleKey: RuleKey;
  title: string;
  description: string;
  severity: ObservationSeverity;
  status: "active" | "suppressed" | "resolved";
  evidence: Record<string, unknown>;
  priorityLevel: PriorityLevel | null;
  priorityScore: number | null;
};

export type RankedDecision = {
  decisionType: DecisionType;
  title: string;
  explanation: string;
  pageUrl: string | null;
  pageId: string | null;
  priorityBand: DecisionPriorityBand;
  rank: number;
  scoring: DecisionScoring;
  confidence: DecisionConfidence;
  evidenceRefs: DecisionEvidenceRef[];
};

export type DecisionRecord = RankedDecision & {
  id: string;
  decisionRunId: string;
  websiteId: string;
  createdAt: string;
};

export type DecisionRunRecord = {
  id: string;
  websiteId: string;
  siteModelId: string;
  crawlRunId: string;
  gscSearchSyncId: string;
  engineVersion: string;
  status: DecisionRunStatus;
  goalId: string;
  goalSnapshot: GoalSnapshot;
  gscTruncated: boolean;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type DecisionView = {
  id: string;
  decisionType: DecisionType;
  title: string;
  explanation: string;
  pageUrl: string | null;
  pageId: string | null;
  priorityBand: DecisionPriorityBand;
  rank: number;
  scoring: DecisionScoring;
  confidence: DecisionConfidence;
  why: {
    searchDemand: { appearances: number; visits: number } | null;
    websiteEvidence: string;
    goalContext: string;
    evidencePeriod: { start: string; end: string } | null;
    matchingConfidence: string;
    truncated: boolean;
  };
};

export const DECISION_PREREQUISITE_REASONS = [
  "missing_site_model",
  "missing_goal",
  "missing_crawl",
  "google_not_connected",
  "missing_gsc_sync",
] as const;

export type DecisionPrerequisiteReason = (typeof DECISION_PREREQUISITE_REASONS)[number];

export const DECISION_EMPTY_REASONS = [
  "empty_gsc_evidence",
  "no_cross_signal_candidates",
] as const;

export type DecisionEmptyReason = (typeof DECISION_EMPTY_REASONS)[number];

export type DecisionsOwnerView = {
  status: "blocked" | "not_generated" | "completed" | "empty";
  current: boolean;
  staleReason: string | null;
  canGenerate: boolean;
  blockedReason: DecisionPrerequisiteReason | null;
  emptyReason: DecisionEmptyReason | null;
  run: {
    id: string;
    engineVersion: string;
    createdAt: string;
    completedAt: string | null;
  } | null;
  decisions: DecisionView[];
};

export class DecisionPrerequisiteError extends Error {
  readonly reason: DecisionPrerequisiteReason;

  constructor(reason: DecisionPrerequisiteReason, message: string) {
    super(message);
    this.name = "DecisionPrerequisiteError";
    this.reason = reason;
  }
}
