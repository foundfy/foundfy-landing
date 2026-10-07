import type { SupportedActionType } from "@/lib/decisions/supported-action";
import type { ActionField } from "./types";

export const ACTION_PREPARE_LABEL = "Prepare this change";
export const ACTION_SAVE_DRAFT_LABEL = "Save draft";
export const ACTION_APPROVE_LABEL = "Approve";
export const ACTION_CANCEL_LABEL = "Cancel";
export const ACTION_CURRENT_NONE_LABEL = "None";
export const ACTION_FIELD_LABEL = "Meta description";
export const ACTION_TITLE_FIELD_LABEL = "Page title";
export const ACTION_PROPOSED_LABEL = "Proposed meta description";
export const ACTION_PROPOSED_TITLE_LABEL = "Proposed title";
export const ACTION_CURRENT_LABEL = "Current meta description";
export const ACTION_CURRENT_TITLE_LABEL = "Current title";
export const ACTION_TITLE_GROUP_COPY =
  "This page shares its title with another Google-visible page. Give this page a title that uniquely describes it.";
export const ACTION_MUTATION_HEADING = "Exact change";
export const ACTION_VERIFY_HEADING = "How Foundfy will verify this later";
export const ACTION_WHY_HEADING = "Why Foundfy recommends this";
export const ACTION_EXECUTE_LABEL = "Apply this change";
export const ACTION_EXECUTE_DISABLED =
  "A site connection is required before Foundfy can apply this change.";
export const ACTION_UNSAFE_STALE_COPY =
  "This action is no longer safe to execute because the underlying evidence has changed.";
export const ACTION_HISTORY_HEADING = "Recent actions";
export const ACTION_STATUS_HEADING = "Status";
export const ACTION_APPROVED_AT_HEADING = "Approved";
export const ACTION_SAFETY_HEADING = "Safety";
export const ACTION_TYPE_HEADING = "Change";
export const ACTION_TYPE_LABEL = "Update meta description";
export const ACTION_TITLE_TYPE_LABEL = "Update page title";
export const ACTION_PAGE_HEADING = "Page";

export function actionTypeLabel(actionType: SupportedActionType): string {
  return actionType === "update_page_title" ? ACTION_TITLE_TYPE_LABEL : ACTION_TYPE_LABEL;
}

export function actionFieldLabel(field: ActionField): string {
  return field === "title" ? ACTION_TITLE_FIELD_LABEL : ACTION_FIELD_LABEL;
}

export function actionCurrentLabel(field: ActionField): string {
  return field === "title" ? ACTION_CURRENT_TITLE_LABEL : ACTION_CURRENT_LABEL;
}

export function actionProposedLabel(field: ActionField): string {
  return field === "title" ? ACTION_PROPOSED_TITLE_LABEL : ACTION_PROPOSED_LABEL;
}

export const ACTION_STATUS_LABELS: Record<
  "prepared" | "awaiting_approval" | "approved" | "executed" | "cancelled" | "blocked",
  string
> = {
  prepared: "Prepared",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  executed: "Executed",
  cancelled: "Cancelled",
  blocked: "Blocked",
};

export const ACTION_SAFETY_LABELS = {
  executable: "Ready to apply",
  adapter_not_connected: "Site connection required",
  unsafe_stale: "No longer safe",
  blocked: "Blocked",
  executed: "Executed",
} as const;
export const ACTION_ERROR_COPY = "Foundfy couldn't prepare this change right now.";
export const ACTION_APPROVED_COPY = "Approved. Foundfy can apply this change.";
export const ACTION_EXECUTED_COPY =
  "Foundfy created the approved change on the site repository. Deployment and crawl verification are separate.";
export const ACTION_BLOCKED_COPY =
  "This change is blocked because the Decision or page evidence is no longer current.";
export const ACTION_VERIFY_LABEL = "Check verification";
export const ACTION_VERIFICATION_STATE_HEADING = "Verification";
export const ACTION_VERIFY_FRESH_CRAWL_COPY =
  "Run a new scan to verify that this change is live.";
export const ACTION_VERIFIED_COPY =
  "Verified — Foundfy re-checked the page and confirmed the meta description matches the approved change.";
export const ACTION_NOT_VERIFIED_COPY =
  "Not verified — Foundfy re-checked the page and the meta description does not match the approved change.";
export const ACTION_INCONCLUSIVE_COPY =
  "Inconclusive — Foundfy could not determine the page state from this crawl.";
export const ACTION_EXPECTED_HEADING = "Expected meta description";
export const ACTION_OBSERVED_HEADING = "Observed meta description";
export const ACTION_VERIFIED_AT_HEADING = "Verified";
export const ACTION_CRAWL_HEADING = "Crawl";
export const ACTION_LEARN_HEADING = "After this change";
export const ACTION_LEARN_WAITING_COPY =
  "Foundfy will compare Google Search evidence after enough time has passed for Google's reporting to settle.";
export const ACTION_LEARN_OTHER_FACTORS_COPY =
  "Search visibility was higher in the comparison period. Other factors may also have contributed.";
export const ACTION_LEARN_DECLINE_CAVEAT_COPY =
  "Search visibility was lower in the comparison period. Other factors may also have contributed.";
export const ACTION_LEARN_MIXED_COPY =
  "Search appearances and visits from Google moved in different directions. Other factors may also have contributed.";
export const ACTION_LEARN_NO_CHANGE_COPY =
  "Search appearances and visits from Google did not change meaningfully in the comparison period.";
export const ACTION_LEARN_INSUFFICIENT_COPY =
  "Foundfy doesn't have enough Google Search evidence to compare this page yet. That does not mean the change failed.";
export const ACTION_LEARN_TRUNCATED_COPY =
  "This page was not in the bounded Google Search page dataset, so Foundfy cannot treat that as zero.";
export const ACTION_LEARN_IDENTITY_COPY =
  "Google's reported URL for this page is no longer a confident match, so Foundfy did not join the two periods.";
export const ACTION_LEARN_REMOVED_COPY =
  "Google Search evidence for this comparison was removed when Search Console was disconnected.";
export const ACTION_LEARN_APPEARANCES_HEADING = "Search appearances";
export const ACTION_LEARN_VISITS_HEADING = "Visits from Google";
export const ACTION_LEARN_CTR_HEADING = "CTR";
export const ACTION_LEARN_POSITION_HEADING = "Average position";
export const ACTION_LEARN_BASELINE_PERIOD_HEADING = "Previous window";
export const ACTION_LEARN_COMPARISON_PERIOD_HEADING = "Comparison window";

export function formatLearningCount(value: number): string {
  return String(Math.round(value));
}

export function formatLearningRange(before: number, after: number): string {
  return `${formatLearningCount(before)} → ${formatLearningCount(after)}`;
}

export function learningObservedCopy(input: {
  appearancesBefore: number;
  appearancesAfter: number;
  visitsBefore: number;
  visitsAfter: number;
}): string {
  const appearanceDelta = Math.round(input.appearancesAfter - input.appearancesBefore);
  const visitDelta = Math.round(input.visitsAfter - input.visitsBefore);
  const appearanceAbs = Math.abs(appearanceDelta);
  const visitAbs = Math.abs(visitDelta);

  if (appearanceDelta > 0 && visitDelta > 0) {
    return `Since this change was verified, this page received ${appearanceAbs} more search appearances and ${visitAbs} more visits from Google than in the previous comparison window.`;
  }
  if (appearanceDelta > 0) {
    return `Since this change was verified, this page received ${appearanceAbs} more search appearances than in the previous comparison window.`;
  }
  if (visitDelta > 0) {
    return `Since this change was verified, this page received ${visitAbs} more visits from Google than in the previous comparison window.`;
  }
  return ACTION_LEARN_NO_CHANGE_COPY;
}
