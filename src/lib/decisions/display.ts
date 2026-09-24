export const DECISION_SECTION_HEADING = "What to do next";
export const DECISION_READY_COPY =
  "Foundfy now has enough evidence to prioritize what matters.";
export const DECISION_GENERATE_LABEL = "Prioritize my next actions";
export const DECISION_REFRESH_LABEL = "Refresh priorities";
export const DECISION_EMPTY_GSC_COPY =
  "Foundfy doesn't have enough Google Search evidence to prioritize cross-signal actions yet.";
export const DECISION_NO_OVERLAP_COPY =
  "Foundfy has search evidence and website evidence, but they don't overlap strongly enough to prioritize an action yet.";
export const DECISION_STALE_COPY = "New evidence is available. Refresh priorities.";
export const DECISION_WHY_LABEL = "Why this?";
export const DECISION_WHY_HEADING = "Why Foundfy prioritized this";
export const DECISION_DEMAND_HEADING = "Existing search demand";
export const DECISION_WEBSITE_EVIDENCE_HEADING = "Website evidence";
export const DECISION_GOAL_HEADING = "Goal context";
export const DECISION_PERIOD_HEADING = "Evidence period";
export const DECISION_BOUNDED_COPY =
  "Imported Google Search evidence for this site is bounded, so this ranking uses the pages Foundfy could import.";
export const DECISION_ERROR_COPY = "Foundfy couldn't prioritize actions right now.";
export const DECISION_PERIOD_VALUE = "Last 28 days";
export const DECISION_CONFIDENCE_HEADING = "Matching confidence";
export const DECISION_PRIORITY_HEADING = "Priority";

export const DECISION_BLOCKED_COPY = {
  missing_site_model:
    "Confirm how Foundfy understands this site before prioritizing actions.",
  missing_goal:
    "Tell Foundfy what should happen when the right people find this site before prioritizing actions.",
  google_not_connected:
    "Connect Google Search before Foundfy can combine search demand with website evidence.",
  missing_gsc_sync:
    "Sync Google search data before Foundfy can prioritize cross-signal actions.",
  missing_crawl: "Complete a website crawl before Foundfy can prioritize actions.",
} as const;

export const DECISION_BLOCKED_ACTION = {
  missing_site_model: { href: "#site-understanding", label: "Review understanding" },
  missing_goal: { href: "#site-goals", label: "Set a goal" },
  google_not_connected: { href: "#site-observe", label: "Connect Google Search" },
  missing_gsc_sync: { href: "#site-observe", label: "Sync Google search data" },
  missing_crawl: null,
} as const;

export const DECISION_BAND_LABELS = {
  do_first: "Do first",
  next: "Next",
  later: "Later",
} as const;
