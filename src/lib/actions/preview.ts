import { ACTION_VERIFICATION_PLAN, ADAPTER_NOT_CONNECTED, TITLE_VERIFICATION_PLAN } from "./config";
import { PAGE_TITLE_ACTION_TYPE } from "@/lib/decisions/supported-action";
import type {
  ActionPreviewView,
  ActionRecord,
  ActionVerificationView,
  ActionLearningView,
  ExecuteBlockedReason,
} from "./types";
import type { DecisionView } from "@/lib/decisions/types";

export function toActionPreview(input: {
  action: ActionRecord;
  decision: Pick<DecisionView, "id" | "title" | "explanation" | "why">;
  executeAvailable: boolean;
  executeBlockedReason: ExecuteBlockedReason;
  verification?: ActionVerificationView | null;
  learning?: ActionLearningView | null;
}): ActionPreviewView {
  return {
    id: input.action.id,
    status: input.action.status,
    actionType: input.action.actionType,
    field: input.action.field,
    targetPage: {
      id: input.action.targetPageId,
      url: input.action.targetPageUrl,
    },
    currentValue: input.action.observedBefore,
    proposedValue: input.action.proposedValue,
    decision: {
      id: input.decision.id,
      title: input.decision.title,
      explanation: input.decision.explanation,
      why: input.decision.why,
    },
    provenance: {
      decisionRunId: input.action.decisionRunId,
      crawlRunId: input.action.crawlRunId,
      gscSyncId: input.action.gscSyncId,
      siteModelId: input.action.siteModelId,
      goalId: input.action.goalId,
    },
    mutationSpec: input.action.mutationSpec,
    verificationPlan:
      input.action.actionType === PAGE_TITLE_ACTION_TYPE
        ? TITLE_VERIFICATION_PLAN
        : ACTION_VERIFICATION_PLAN,
    evidenceRefs: input.action.evidenceRefs,
    approvedAt: input.action.approvedAt,
    executeAvailable: input.executeAvailable,
    executeBlockedReason: input.executeBlockedReason,
    verification: input.verification ?? null,
    learning: input.learning ?? null,
  };
}

export function executeAvailability(input: {
  status: ActionRecord["status"];
  unsafe: boolean;
  adapterReady: boolean;
}): { executeAvailable: boolean; executeBlockedReason: ExecuteBlockedReason } {
  if (input.status === "blocked" || input.status === "executed") {
    return { executeAvailable: false, executeBlockedReason: null };
  }

  if (input.status !== "approved") {
    return { executeAvailable: false, executeBlockedReason: null };
  }

  if (input.unsafe) {
    return { executeAvailable: false, executeBlockedReason: "unsafe_stale" };
  }

  if (!input.adapterReady) {
    return { executeAvailable: false, executeBlockedReason: ADAPTER_NOT_CONNECTED };
  }

  return { executeAvailable: true, executeBlockedReason: null };
}
