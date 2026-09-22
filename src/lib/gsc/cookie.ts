import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  OBSERVE_SESSION_COOKIE,
  OWNER_SESSION_MAX_AGE_SECONDS,
  getSessionSecret,
} from "./config";

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string, secret = getSessionSecret()): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function sessionTokensEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function buildSessionCookieOptions(
  nowNodeEnv = process.env.NODE_ENV,
): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: nowNodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OWNER_SESSION_MAX_AGE_SECONDS,
  };
}

export function buildClearedSessionCookieOptions(): SessionCookieOptions {
  return {
    ...buildSessionCookieOptions(),
    maxAge: 0,
  };
}

export function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator);
    if (key !== name) {
      continue;
    }

    return decodeURIComponent(trimmed.slice(separator + 1));
  }

  return null;
}

export function readObserveSessionToken(request: Request): string | null {
  return readCookieValue(request.headers.get("cookie"), OBSERVE_SESSION_COOKIE);
}
