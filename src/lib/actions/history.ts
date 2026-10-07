import { META_DESCRIPTION_ACTION_TYPE } from "@/lib/decisions/supported-action";
import type { ActionPreviewView, ActionStatus } from "./types";

export function canSubmitExecute(status: ActionStatus): boolean {
  return status === "approved";
}

export function canOfferExecute(
  action: Pick<ActionPreviewView, "status" | "actionType">,
): boolean {
  return action.status === "approved" && action.actionType === META_DESCRIPTION_ACTION_TYPE;
}

export function actionSafetyState(
  action: Pick<ActionPreviewView, "status" | "executeAvailable" | "executeBlockedReason">,
): "executable" | "adapter_not_connected" | "unsafe_stale" | "blocked" | "executed" | null {
  if (action.status === "blocked") {
    return "blocked";
  }

  if (action.status === "executed") {
    return "executed";
  }

  if (action.status !== "approved") {
    return null;
  }

  if (action.executeBlockedReason === "unsafe_stale") {
    return "unsafe_stale";
  }

  if (action.executeBlockedReason === "adapter_not_connected") {
    return "adapter_not_connected";
  }

  if (action.executeAvailable) {
    return "executable";
  }

  return null;
}
