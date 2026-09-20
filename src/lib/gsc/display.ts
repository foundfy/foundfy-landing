export const OBSERVE_SECTION_HEADING = "Google Search";
export const OBSERVE_CONNECT_LABEL = "Connect Google";
export const OBSERVE_CONNECTED_TITLE = "Google account connected";
export const OBSERVE_CONNECTED_NEXT =
  "Next: choose the Search Console property for this site.";
export const OBSERVE_DISCONNECT_LABEL = "Disconnect";

export const OBSERVE_NOTICE_COPY = {
  connected: "Google account connected.",
  denied: "Google Search was not connected.",
  already_connected: "This site already has a Google account connected.",
  disconnected: "Google account disconnected.",
  error: "Unable to connect Google right now.",
} as const;

export function assertObserveCopyDoesNotClaimSearchConsoleConnected(text: string): void {
  if (/search console connected/i.test(text)) {
    throw new Error("OBSERVE copy must not say Search Console is connected.");
  }
}
