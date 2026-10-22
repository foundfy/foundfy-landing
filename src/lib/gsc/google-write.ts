import { GoogleAuthExpiredError, SearchPresenceGoogleError } from "./types";

export const SEARCH_PRESENCE_PERMISSION_COPY =
  "Foundfy needs permission to set up Search Console for this website.";
export const SEARCH_PRESENCE_TRANSIENT_COPY =
  "Google is temporarily unavailable. You can try again.";
export const SEARCH_PRESENCE_INVALID_COPY =
  "Search Console setup couldn't be completed right now.";
export const SEARCH_PRESENCE_UNCONFIRMED_COPY =
  "Search Console setup could not be confirmed yet. You can try again.";

export type GoogleSiteAddResult = "added" | "conflict";

export function throwForGoogleSetupFailure(status: number): never {
  if (status === 401) {
    throw new GoogleAuthExpiredError();
  }

  if (status === 403) {
    throw new SearchPresenceGoogleError("permission", SEARCH_PRESENCE_PERMISSION_COPY, status);
  }

  if (status === 429 || status >= 500) {
    throw new SearchPresenceGoogleError("transient", SEARCH_PRESENCE_TRANSIENT_COPY, status);
  }

  throw new SearchPresenceGoogleError("invalid", SEARCH_PRESENCE_INVALID_COPY, status);
}

export async function discardGoogleErrorBody(response: Response): Promise<void> {
  await response.text().catch(() => "");
}
