import type { DecisionEvidenceKind, DecisionView } from "@/lib/decisions/types";
import type { SupportedActionType } from "@/lib/decisions/supported-action";

export const ACTION_STATUSES = [
  "prepared",
  "awaiting_approval",
  "approved",
  "cancelled",
  "blocked",
] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_ATTEMPT_RESULTS = ["success", "failure", "ambiguous"] as const;

export type ActionAttemptResult = (typeof ACTION_ATTEMPT_RESULTS)[number];

export const ACTION_ERROR_CODES = [
  "unsupported_decision",
  "decision_not_found",
  "decision_stale",
  "missing_page",
  "observation_no_longer_supports",
  "action_not_found",
  "not_editable",
  "empty_proposed_value",
  "invalid_proposed_value",
  "not_cancellable",
  "not_approved",
  "adapter_not_connected",
  "provenance_changed",
] as const;

export type ActionErrorCode = (typeof ACTION_ERROR_CODES)[number];

export type MetaDescriptionMutationSpec = {
  targetUrl: string;
  field: "meta_description";
  before: null;
  after: string | null;
};

export type ActionMutationSpec = MetaDescriptionMutationSpec;

export type ActionEvidenceRef = {
  kind: DecisionEvidenceKind;
  recordId: string;
  snapshot: Record<string, unknown>;
};

export type ActionRecord = {
  id: string;
  websiteId: string;
  decisionId: string;
  decisionRunId: string;
  ownerId: string;
  actionType: SupportedActionType;
  targetPageId: string;
  targetPageUrl: string;
  field: "meta_description";
  observedBefore: string | null;
  proposedValue: string | null;
  mutationSpec: ActionMutationSpec;
  pageContentHashAtPrepare: string | null;
  crawlRunId: string;
  gscSyncId: string;
  siteModelId: string;
  goalId: string;
  status: ActionStatus;
  approvedByOwnerId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  evidenceRefs: ActionEvidenceRef[];
};

export type ActionAttemptRecord = {
  id: string;
  actionId: string;
  attemptNumber: number;
  idempotencyKey: string;
  provider: string | null;
  result: ActionAttemptResult;
  errorCode: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export type ActionPreviewView = {
  id: string;
  status: ActionStatus;
  actionType: SupportedActionType;
  field: "meta_description";
  targetPage: {
    id: string;
    url: string;
  };
  currentValue: string | null;
  proposedValue: string | null;
  decision: {
    id: string;
    title: string;
    explanation: string;
    why: DecisionView["why"];
  };
  provenance: {
    decisionRunId: string;
    crawlRunId: string;
    gscSyncId: string;
    siteModelId: string;
    goalId: string;
  };
  mutationSpec: ActionMutationSpec;
  verificationPlan: string;
  evidenceRefs: ActionEvidenceRef[];
  approvedAt: string | null;
  executeAvailable: false;
  executeBlockedReason: "adapter_not_connected" | null;
};

export class ActionError extends Error {
  readonly code: ActionErrorCode;
  readonly status: number;

  constructor(code: ActionErrorCode, message: string, status = 409) {
    super(message);
    this.name = "ActionError";
    this.code = code;
    this.status = status;
  }
}
