import {
  GOOGLE_OAUTH_REVOKE_URL,
  GOOGLE_OAUTH_TOKEN_URL,
  GOOGLE_OAUTH_USERINFO_URL,
  getGoogleClientId,
  getGoogleClientSecret,
  getOAuthRedirectUri,
} from "./config";

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
