import { ACTION_VERIFICATION_PLAN, ADAPTER_NOT_CONNECTED } from "./config";
import type { ActionPreviewView, ActionRecord } from "./types";
import type { DecisionView } from "@/lib/decisions/types";

export function toActionPreview(input: {
  action: ActionRecord;
  decision: Pick<DecisionView, "id" | "title" | "explanation" | "why">;
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
    verificationPlan: ACTION_VERIFICATION_PLAN,
    evidenceRefs: input.action.evidenceRefs,
    approvedAt: input.action.approvedAt,
    executeAvailable: false,
    executeBlockedReason:
      input.action.status === "approved" ? ADAPTER_NOT_CONNECTED : null,
  };
}
