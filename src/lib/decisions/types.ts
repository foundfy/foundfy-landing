import type { WebsiteGoalType } from "@/lib/goals/types";
import type { ObservationSeverity, RuleKey } from "@/lib/observations/types";
import type { PriorityLevel } from "@/lib/priorities/types";

export const DECISION_V1_TYPES = [
  "existing_demand_page_issue",
  "inspect_unanalyzed_page",
  "multi_page_issue_with_visibility",
] as const;

export const RESEARCH_INSPECT_DECISION_TYPE = "inspect_related_demand_against_pages" as const;

export const DECISION_TYPES = [...DECISION_V1_TYPES, RESEARCH_INSPECT_DECISION_TYPE] as const;

export type DecisionV1Type = (typeof DECISION_V1_TYPES)[number];
export type DecisionType = (typeof DECISION_TYPES)[number];

export const RESEARCH_INSPECT_T0_STATES = [
  "clear_existing_page_evidence",
  "no_obvious_match_in_current_crawl",
  "ambiguous",
] as const;

export const RESEARCH_INSPECT_T1_STATES = [
  "clear_existing_page_evidence",
  "no_obvious_match_after_targeted_observation",
  "ambiguous",
] as const;

export const RESEARCH_INSPECT_STATES = [
  "clear_existing_page_evidence",
  "no_obvious_match_in_current_crawl",
  "no_obvious_match_after_targeted_observation",
  "ambiguous",
] as const;

export type ResearchInspectState = (typeof RESEARCH_INSPECT_STATES)[number];

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
  | "goal"
  | "research_run"
  | "research_idea"
  | "targeted_observation";

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

export type DecisionEngineVersion = "decision_v1" | "decision_research_inspect_v0";

export type GscPageEvidenceInput = {
  id: string;
  pageUrl: string;
  pageId: string | null;
  storedPageId?: string | null;
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
  decisionType: DecisionV1Type;
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

export type DecisionV1Record = RankedDecision & {
  id: string;
  decisionRunId: string;
  websiteId: string;
  createdAt: string;
};

export type ResearchInspectDecision = {
  decisionType: typeof RESEARCH_INSPECT_DECISION_TYPE;
  title: string;
  explanation: string;
  pageUrl: string | null;
  pageId: string | null;
  priorityBand: null;
  rank: null;
  scoring: null;
  confidence: null;
  inspectionState: ResearchInspectState;
  evidenceRefs: DecisionEvidenceRef[];
};

export type ResearchInspectDecisionRecord = ResearchInspectDecision & {
  id: string;
  decisionRunId: string;
  websiteId: string;
  createdAt: string;
};

export type DecisionRecord = DecisionV1Record | ResearchInspectDecisionRecord;

export type DecisionRunRecord = {
  id: string;
  websiteId: string;
  siteModelId: string;
  crawlRunId: string;
  gscSearchSyncId: string | null;
  engineVersion: string;
  status: DecisionRunStatus;
  goalId: string | null;
  goalSnapshot: GoalSnapshot | Record<string, unknown>;
  gscTruncated: boolean;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
  researchIdeaId: string | null;
  targetedObservationId?: string | null;
};

export type DecisionV1RunRecord = DecisionRunRecord & {
  engineVersion: "decision_v1";
  gscSearchSyncId: string;
  goalId: string;
  goalSnapshot: GoalSnapshot;
  researchIdeaId: null;
};

export function isGoalSnapshot(value: GoalSnapshot | Record<string, unknown>): value is GoalSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as GoalSnapshot).id === "string" &&
    typeof (value as GoalSnapshot).primaryType === "string" &&
    typeof (value as GoalSnapshot).updatedAt === "string"
  );
}

export function asDecisionV1Run(run: DecisionRunRecord): DecisionV1RunRecord {
  if (run.engineVersion === "decision_research_inspect_v0" || run.gscSearchSyncId == null) {
    throw new Error("Expected a decision_v1 run with GSC and goal evidence.");
  }

  return run as DecisionV1RunRecord;
}

export function isResearchInspectState(value: string | null | undefined): value is ResearchInspectState {
  return value != null && (RESEARCH_INSPECT_STATES as readonly string[]).includes(value);
}

export function isResearchInspectDecisionRecord(
  decision: DecisionRecord,
): decision is ResearchInspectDecisionRecord {
  return decision.decisionType === RESEARCH_INSPECT_DECISION_TYPE;
}

export function asDecisionV1Record(decision: DecisionRecord): DecisionV1Record {
  if (isResearchInspectDecisionRecord(decision)) {
    throw new Error("Expected a decision_v1 ranked Decision.");
  }

  return decision;
}

export function asResearchInspectDecisionRecord(
  decision: DecisionRecord,
): ResearchInspectDecisionRecord {
  if (!isResearchInspectDecisionRecord(decision)) {
    throw new Error("Expected a research inspection Decision.");
  }

  return decision;
}

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
  supportedActionType: "update_meta_description" | "update_page_title" | null;
  supportedReviewType: "review_canonical_target" | null;
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
