export const GOOGLE_OAUTH_AUTHORIZATION_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_OAUTH_USERINFO_URL =
  "https://openidconnect.googleapis.com/v1/userinfo";
export const GOOGLE_OAUTH_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_WEBMASTERS_SITES_URL =
  "https://www.googleapis.com/webmasters/v3/sites";

export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/webmasters.readonly",
] as const;

export const GOOGLE_OAUTH_SCOPE_STRING = GOOGLE_OAUTH_SCOPES.join(" ");

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const OWNER_SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const OWNER_SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export const OBSERVE_SESSION_COOKIE = "foundfy_gsc_session";
export const TOKEN_ENCRYPTION_KEY_ID = "v1";
export const OAUTH_CALLBACK_PATH = "/api/gsc/oauth/callback";

export const OBSERVE_NOTICE_VALUES = [
  "connected",
  "denied",
  "already_connected",
  "disconnected",
  "error",
] as const;

export type ObserveNotice = (typeof OBSERVE_NOTICE_VALUES)[number];

function compactEnv(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, "").trim();
}

export function getGoogleClientId(): string {
  const value = compactEnv(process.env.GOOGLE_CLIENT_ID);
  if (!value) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }
  return value;
}

export function getGoogleClientSecret(): string {
  const value = compactEnv(process.env.GOOGLE_CLIENT_SECRET);
  if (!value) {
    throw new Error("GOOGLE_CLIENT_SECRET is not configured.");
  }
  return value;
}

export function getSessionSecret(): string {
  const value = compactEnv(process.env.GSC_SESSION_SECRET);
  if (!value) {
    throw new Error("GSC_SESSION_SECRET is not configured.");
  }
  return value;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    compactEnv(process.env.GOOGLE_CLIENT_ID) &&
      compactEnv(process.env.GOOGLE_CLIENT_SECRET) &&
      compactEnv(process.env.GSC_TOKEN_ENCRYPTION_KEY) &&
      compactEnv(process.env.GSC_SESSION_SECRET),
  );
}

export function getOAuthRedirectUri(requestUrl: string): string {
  const configured = process.env.GSC_OAUTH_REDIRECT_URI?.trim();
  if (configured) {
    return configured;
  }

  const url = new URL(requestUrl);
  return `${url.origin}${OAUTH_CALLBACK_PATH}`;
}

export function siteObservePath(websiteId: string, notice?: ObserveNotice): string {
  if (!notice) {
    return `/site/${websiteId}`;
  }

  return `/site/${websiteId}?observe=${notice}`;
}
