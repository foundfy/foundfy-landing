export const ACTION_PREPARE_LABEL = "Prepare this change";
export const ACTION_SAVE_DRAFT_LABEL = "Save draft";
export const ACTION_APPROVE_LABEL = "Approve";
export const ACTION_CANCEL_LABEL = "Cancel";
export const ACTION_CURRENT_NONE_LABEL = "None";
export const ACTION_FIELD_LABEL = "Meta description";
export const ACTION_PROPOSED_LABEL = "Proposed meta description";
export const ACTION_CURRENT_LABEL = "Current meta description";
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
export const ACTION_PAGE_HEADING = "Page";

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
