import { randomBytes } from "node:crypto";
import {
  GOOGLE_OAUTH_AUTHORIZATION_URL,
  GOOGLE_OAUTH_SCOPE_STRING,
  getGoogleClientId,
  getOAuthRedirectUri,
} from "./config";

export function createOAuthStateValue(): string {
  return randomBytes(32).toString("base64url");
}

export function buildGoogleAuthorizationUrl(input: {
  requestUrl: string;
  state: string;
}): string {
  const url = new URL(GOOGLE_OAUTH_AUTHORIZATION_URL);
  url.searchParams.set("client_id", getGoogleClientId());
  url.searchParams.set("redirect_uri", getOAuthRedirectUri(input.requestUrl));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPE_STRING);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("state", input.state);
  return url.toString();
}
