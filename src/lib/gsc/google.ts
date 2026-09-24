import {
  GOOGLE_OAUTH_REVOKE_URL,
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_OAUTH_USERINFO_URL,
  GOOGLE_WEBMASTERS_SITES_URL,
  getGoogleClientId,
  getGoogleClientSecret,
  getOAuthRedirectUri,
} from "./config";
import type { GoogleSiteEntry } from "./match";
import { GoogleAuthExpiredError } from "./types";

export type GoogleTokenResponse = {
  accessToken: string;
  refreshToken: string;
};

export type GoogleUserInfo = {
  sub: string;
  email: string | null;
};

type TokenEndpointJson = {
  access_token?: unknown;
  refresh_token?: unknown;
  error?: unknown;
};

type UserInfoJson = {
  sub?: unknown;
  email?: unknown;
};

export async function exchangeGoogleAuthorizationCode(input: {
  code: string;
  requestUrl: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    redirect_uri: getOAuthRedirectUri(input.requestUrl),
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as TokenEndpointJson;

  if (!response.ok) {
    const googleError =
      typeof payload.error === "string" ? payload.error : `http_${response.status}`;
    throw new Error(`Google authorization code exchange failed (${googleError}).`);
  }

  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token : "";
  const refreshToken =
    typeof payload.refresh_token === "string" ? payload.refresh_token : "";

  if (!accessToken) {
    throw new Error("Google did not return an access token.");
  }

  if (!refreshToken) {
    throw new Error("Google did not return a refresh token.");
  }

  return { accessToken, refreshToken };
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_OAUTH_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as UserInfoJson;

  if (!response.ok || typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Google identity could not be resolved.");
  }

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
  };
}

export async function revokeGoogleToken(token: string): Promise<void> {
  const body = new URLSearchParams({ token });
  const response = await fetch(GOOGLE_OAUTH_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok && response.status !== 400) {
    throw new Error("Google token revocation failed.");
  }
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as TokenEndpointJson;
  const googleError = typeof payload.error === "string" ? payload.error : null;

  if (!response.ok) {
    if (googleError === "invalid_grant" || response.status === 400 || response.status === 401) {
      throw new GoogleAuthExpiredError();
    }
    throw new Error(`Google token refresh failed (${googleError ?? `http_${response.status}`}).`);
  }

  const accessToken =
    typeof payload.access_token === "string" ? payload.access_token : "";
  if (!accessToken) {
    throw new GoogleAuthExpiredError();
  }

  return accessToken;
}

type SitesListJson = {
  siteEntry?: unknown;
};

export async function listSearchConsoleSites(
  accessToken: string,
): Promise<GoogleSiteEntry[]> {
  const response = await fetch(GOOGLE_WEBMASTERS_SITES_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    throw new GoogleAuthExpiredError();
  }

  const payload = (await response.json().catch(() => ({}))) as SitesListJson;
  if (!response.ok) {
    throw new Error("Search Console properties could not be listed.");
  }

  if (!Array.isArray(payload.siteEntry)) {
    return [];
  }

  return payload.siteEntry.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const siteUrl =
      "siteUrl" in entry && typeof entry.siteUrl === "string" ? entry.siteUrl : "";
    if (!siteUrl) {
      return [];
    }
    const permissionLevel =
      "permissionLevel" in entry && typeof entry.permissionLevel === "string"
        ? entry.permissionLevel
        : null;
    return [{ siteUrl, permissionLevel }];
  });
}
