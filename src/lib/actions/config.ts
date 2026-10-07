export const META_DESCRIPTION_MAX_LENGTH = 320;
export const TITLE_MAX_LENGTH = META_DESCRIPTION_MAX_LENGTH;
export const ACTION_PROPOSED_VALUE_MAX_LENGTH = META_DESCRIPTION_MAX_LENGTH;

export const ACTION_VERIFICATION_PLAN =
  "After execution, Foundfy will re-check this page and confirm whether the meta description changed.";

export const TITLE_VERIFICATION_PLAN =
  "After a later title execution, Foundfy will re-crawl this page and confirm the live title matches the approved value. If this page currently shares its title, Foundfy will also check that this page no longer uses the previous shared title. Changing this one page does not by itself resolve every duplicate-title page.";

export const ADAPTER_NOT_CONNECTED = "adapter_not_connected" as const;

export const OPEN_ACTION_STATUSES = ["prepared", "awaiting_approval", "approved"] as const;

export const EDITABLE_ACTION_STATUSES = ["prepared", "awaiting_approval"] as const;

export const CANCELLABLE_ACTION_STATUSES = [
  "prepared",
  "awaiting_approval",
  "approved",
] as const;
