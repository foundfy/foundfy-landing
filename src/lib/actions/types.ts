import type { DecisionEvidenceKind, DecisionView } from "@/lib/decisions/types";
import type { SupportedActionType } from "@/lib/decisions/supported-action";

export const ACTION_STATUSES = [
  "prepared",
  "awaiting_approval",
  "approved",
  "executed",
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
  "before_state_changed",
  "remote_state_changed",
  "git_concurrency_conflict",
  "unexpected_source_shape",
  "github_auth_failed",
  "not_executed",
  "fresh_crawl_required",
] as const;

export type ActionErrorCode = (typeof ACTION_ERROR_CODES)[number];

export type ExecuteBlockedReason = "adapter_not_connected" | "unsafe_stale" | null;

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

export type ActionExecutionArtifact = {
  provider?: string;
  repo?: string;
  branch?: string;
  filePath?: string;
  headShaBefore?: string;
  commitShaAfter?: string;
  blobShaBefore?: string;
  blobShaAfter?: string;
  treeShaAfter?: string;
  beforeValue?: string | null;
  afterValue?: string | null;
  installationId?: string;
  recovered?: boolean;
  deploymentObserved?: boolean;
  deploymentObservedAt?: string | null;
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
  artifact: ActionExecutionArtifact;
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
  executeAvailable: boolean;
  executeBlockedReason: ExecuteBlockedReason;
  verification: ActionVerificationView | null;
};

export const ACTION_VERIFICATION_STATUSES = ["verified", "not_verified", "inconclusive"] as const;

export type ActionVerificationStatus = (typeof ACTION_VERIFICATION_STATUSES)[number];

export type ActionVerificationEvidenceSnapshot = {
  crawlRunId?: string;
  crawlCompletedAt?: string | null;
  pageId?: string | null;
  requestedUrl?: string | null;
  finalUrl?: string | null;
  statusCode?: number | null;
  metaDescription?: string | null;
  contentHash?: string | null;
  missingMetaObservationId?: string | null;
  missingMetaPresent?: boolean;
  fetchedSuccessfully?: boolean;
};

export type ActionVerificationRecord = {
  id: string;
  actionId: string;
  websiteId: string;
  executionAttemptId: string;
  crawlRunId: string;
  targetPageId: string | null;
  verificationType: "update_meta_description";
  status: ActionVerificationStatus;
  expectedValue: string | null;
  observedValue: string | null;
  evidenceSnapshot: ActionVerificationEvidenceSnapshot;
  verifiedAt: string | null;
  createdAt: string;
};

export type ActionVerificationView = {
  state: "fresh_crawl_required" | "ready" | ActionVerificationStatus;
  canCheck: boolean;
  expectedValue: string | null;
  observedValue: string | null;
  verifiedAt: string | null;
  crawlRunId: string | null;
  crawlCompletedAt: string | null;
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
