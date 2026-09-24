export const OBSERVE_SECTION_HEADING = "Google Search";
export const OBSERVE_CONNECT_LABEL = "Connect Google";
export const OBSERVE_CONNECTED_TITLE = "Google account connected";
export const OBSERVE_CONNECTED_NEXT =
  "Next: choose the Search Console property for this site.";
export const OBSERVE_DISCONNECT_LABEL = "Disconnect";
export const OBSERVE_SEARCH_CONSOLE_CONNECTED_TITLE = "Search Console connected";
export const OBSERVE_SEARCH_CONSOLE_CONNECTED_NEXT =
  "Foundfy is ready to observe how this site appears in Google Search.";
export const OBSERVE_SYNC_LABEL = "Sync Google search data";
export const OBSERVE_EVIDENCE_TITLE = "Google Search evidence";
export const OBSERVE_EVIDENCE_PERIOD_LABEL = "Last 28 days";
export const OBSERVE_EVIDENCE_EMPTY_COPY =
  "Google hasn't reported search performance for this period yet.";
export const OBSERVE_EVIDENCE_DETAIL_LABEL = "View Google search evidence";
export const OBSERVE_EVIDENCE_HIDE_LABEL = "Hide Google search evidence";
export const OBSERVE_EVIDENCE_LAG_COPY =
  "Google Search data is not always complete for the most recent days.";
export const OBSERVE_EVIDENCE_SYNC_ERROR = "Google Search data couldn't be refreshed right now.";
export const OBSERVE_APPEARANCES_LABEL = "Search appearances";
export const OBSERVE_VISITS_LABEL = "Visits from Google";
export const OBSERVE_PAGES_SEEN_LABEL = "Pages seen in search";
export const OBSERVE_QUERIES_REPORTED_LABEL = "Queries Google reported";
export const OBSERVE_LAST_SYNCED_LABEL = "Last synced";
export const OBSERVE_QUERIES_HEADING = "Queries Google reported";
export const OBSERVE_PAGES_HEADING = "Pages";
export const OBSERVE_FOUND_PROPERTY_TITLE =
  "We found a Search Console property for this site";
export const OBSERVE_USE_PROPERTY_LABEL = "Use this property";
export const OBSERVE_CHANGE_PROPERTY_LABEL = "Change property";
export const OBSERVE_NO_PROPERTY_COPY =
  "We couldn't find a Search Console property for this site in this Google account.";
export const OBSERVE_LIKELY_HEADING = "Likely matches";
export const OBSERVE_OTHER_HEADING = "Other accessible properties";
export const OBSERVE_LOADING_PROPERTIES = "Looking for Search Console properties…";
export const OBSERVE_EXPIRED_COPY = "Google access expired. Connect Google again.";

export const OBSERVE_NOTICE_COPY = {
  connected: "Google account connected.",
  denied: "Google Search was not connected.",
  already_connected: "This site already has a Google account connected.",
  disconnected: "Google account disconnected.",
  error: "Unable to connect Google right now.",
} as const;

export function googleConnectedCopy(): string {
  return [
    OBSERVE_SECTION_HEADING,
    OBSERVE_CONNECT_LABEL,
    OBSERVE_CONNECTED_TITLE,
    OBSERVE_CONNECTED_NEXT,
    OBSERVE_NO_PROPERTY_COPY,
    OBSERVE_FOUND_PROPERTY_TITLE,
    ...Object.values(OBSERVE_NOTICE_COPY),
  ].join(" ");
}
