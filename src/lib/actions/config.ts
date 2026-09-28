export const META_DESCRIPTION_MAX_LENGTH = 320;

export const ACTION_VERIFICATION_PLAN =
  "After execution, Foundfy will re-check this page and confirm whether the meta description changed.";

export const ADAPTER_NOT_CONNECTED = "adapter_not_connected" as const;

export const OPEN_ACTION_STATUSES = ["prepared", "awaiting_approval", "approved"] as const;

export const EDITABLE_ACTION_STATUSES = ["prepared", "awaiting_approval"] as const;

export const CANCELLABLE_ACTION_STATUSES = [
  "prepared",
  "awaiting_approval",
  "approved",
] as const;
