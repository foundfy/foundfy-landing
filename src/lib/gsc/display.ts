export const OBSERVE_SECTION_HEADING = "Google Search";
export const OBSERVE_CONNECT_LABEL = "Connect Google";
export const OBSERVE_CONNECTED_TITLE = "Google account connected";
export const OBSERVE_CONNECTED_NEXT =
  "Next: choose the Search Console property for this site.";
export const OBSERVE_DISCONNECT_LABEL = "Disconnect";
export const OBSERVE_SEARCH_CONSOLE_CONNECTED_TITLE = "Search Console connected";
export const OBSERVE_SEARCH_CONSOLE_CONNECTED_NEXT =
  "Foundfy can now begin observing how this site appears in Google Search.";
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
