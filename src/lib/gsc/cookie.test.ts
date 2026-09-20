import { afterEach, describe, expect, it } from "vitest";
import {
  OBSERVE_SESSION_COOKIE,
  OWNER_SESSION_MAX_AGE_SECONDS,
} from "./config";
import {
  buildClearedSessionCookieOptions,
  buildSessionCookieOptions,
  createSessionToken,
  hashSessionToken,
  readCookieValue,
  sessionTokensEqual,
} from "./cookie";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("observe owner session cookie", () => {
  it("sets HttpOnly, SameSite=Lax, path /, and Secure only in production", () => {
    const production = buildSessionCookieOptions("production");
    expect(production).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: OWNER_SESSION_MAX_AGE_SECONDS,
    });

    const development = buildSessionCookieOptions("development");
    expect(development.secure).toBe(false);
    expect(development.httpOnly).toBe(true);
    expect(buildClearedSessionCookieOptions().maxAge).toBe(0);
    expect(OBSERVE_SESSION_COOKIE).toBe("foundfy_gsc_session");
  });

  it("hashes session tokens with the session secret", () => {
    process.env.GSC_SESSION_SECRET = "session-secret";
    const token = createSessionToken();
    const hash = hashSessionToken(token);

    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
    expect(sessionTokensEqual(hash, hashSessionToken(token))).toBe(true);
    expect(sessionTokensEqual(hash, hashSessionToken("other"))).toBe(false);
  });

  it("reads the observe session cookie from the Cookie header", () => {
    expect(
      readCookieValue("other=1; foundfy_gsc_session=abc123; more=2", OBSERVE_SESSION_COOKIE),
    ).toBe("abc123");
    expect(readCookieValue(null, OBSERVE_SESSION_COOKIE)).toBeNull();
  });
});
