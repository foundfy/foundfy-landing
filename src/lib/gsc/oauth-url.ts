import { randomBytes } from "node:crypto";
import {
  GOOGLE_OAUTH_AUTHORIZATION_URL,
  GOOGLE_OAUTH_SCOPE_STRING,
  GOOGLE_OAUTH_SETUP_SCOPE_STRING,
  getGoogleClientId,
  getOAuthRedirectUri,
} from "./config";
import type { GoogleOAuthPurpose } from "./oauth-purpose";
import { GOOGLE_SITE_VERIFICATION_SCOPE } from "./scopes";

export function createOAuthStateValue(): string {
  return randomBytes(32).toString("base64url");
}

export function buildGoogleAuthorizationUrl(input: {
  requestUrl: string;
  state: string;
  purpose?: GoogleOAuthPurpose;
  includeGrantedScopes?: boolean;
}): string {
  const purpose = input.purpose ?? "connect";
  const includeGrantedScopes = input.includeGrantedScopes ?? true;
  const url = new URL(GOOGLE_OAUTH_AUTHORIZATION_URL);
  url.searchParams.set("client_id", getGoogleClientId());
  url.searchParams.set("redirect_uri", getOAuthRedirectUri(input.requestUrl));
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    purpose === "setup" ? GOOGLE_OAUTH_SETUP_SCOPE_STRING : GOOGLE_OAUTH_SCOPE_STRING,
  );
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", includeGrantedScopes ? "true" : "false");
  url.searchParams.set("state", input.state);
  if (purpose === "setup") {
    const requested = url.searchParams.get("scope") ?? "";
    if (requested.split(/\s+/).includes(GOOGLE_SITE_VERIFICATION_SCOPE)) {
      throw new Error("C0 setup must not request full siteverification.");
    }
  }
  return url.toString();
}
