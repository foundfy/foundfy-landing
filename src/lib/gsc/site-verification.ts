import {
  GOOGLE_SITE_VERIFICATION_TOKEN_URL,
  GOOGLE_SITE_VERIFICATION_WEB_RESOURCE_URL,
} from "./config";
import {
  discardGoogleErrorBody,
  SEARCH_PRESENCE_INVALID_COPY,
  throwForGoogleSetupFailure,
} from "./google-write";
import { GoogleAuthExpiredError, SearchPresenceGoogleError } from "./types";

export const SITE_VERIFICATION_METHOD_DNS_TXT = "DNS_TXT" as const;
export const SITE_VERIFICATION_SITE_TYPE_INET_DOMAIN = "INET_DOMAIN" as const;

type TokenJson = {
  token?: unknown;
};

function inetDomainBody(identifier: string): {
  verificationMethod: typeof SITE_VERIFICATION_METHOD_DNS_TXT;
  site: {
    type: typeof SITE_VERIFICATION_SITE_TYPE_INET_DOMAIN;
    identifier: string;
  };
} {
  return {
    verificationMethod: SITE_VERIFICATION_METHOD_DNS_TXT,
    site: {
      type: SITE_VERIFICATION_SITE_TYPE_INET_DOMAIN,
      identifier,
    },
  };
}

export async function getDnsTxtVerificationToken(
  accessToken: string,
  identifier: string,
): Promise<string> {
  const response = await fetch(GOOGLE_SITE_VERIFICATION_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(inetDomainBody(identifier)),
    cache: "no-store",
  });

  if (response.status === 401) {
    await discardGoogleErrorBody(response);
    throw new GoogleAuthExpiredError();
  }

  if (!response.ok) {
    await discardGoogleErrorBody(response);
    throwForGoogleSetupFailure(response.status);
  }

  const payload = (await response.json().catch(() => ({}))) as TokenJson;
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  if (!token) {
    throw new SearchPresenceGoogleError("invalid", SEARCH_PRESENCE_INVALID_COPY, 502);
  }

  return token;
}

export async function insertDnsTxtVerification(
  accessToken: string,
  identifier: string,
): Promise<"verified" | "pending"> {
  const url = new URL(GOOGLE_SITE_VERIFICATION_WEB_RESOURCE_URL);
  url.searchParams.set("verificationMethod", SITE_VERIFICATION_METHOD_DNS_TXT);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      site: {
        type: SITE_VERIFICATION_SITE_TYPE_INET_DOMAIN,
        identifier,
      },
    }),
    cache: "no-store",
  });

  if (response.ok) {
    return "verified";
  }

  await discardGoogleErrorBody(response);

  if (response.status === 400) {
    return "pending";
  }

  throwForGoogleSetupFailure(response.status);
}
