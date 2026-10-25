import { describe, expect, it } from "vitest";
import {
  resolveGoogleGrantReplacement,
  returnedGrantLacksExistingCapabilities,
} from "./oauth-grant";
import { persistableGrantedScopeString } from "./scopes";

const READONLY = persistableGrantedScopeString(
  "openid email https://www.googleapis.com/auth/webmasters.readonly",
);
const SETUP = persistableGrantedScopeString(
  "openid email https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/siteverification.verify_only",
);
const WRITE_ONLY = persistableGrantedScopeString(
  "https://www.googleapis.com/auth/webmasters",
);

describe("Google grant replacement", () => {
  it("A: keeps the existing refresh token when reconnect returns combined scopes and no new refresh token", () => {
    const resolved = resolveGoogleGrantReplacement({
      existingScopes: SETUP,
      existingRefreshCiphertext: "existing-cipher",
      returnedScopes: SETUP,
      newRefreshCiphertext: null,
    });

    expect(resolved).toEqual({
      scopes: SETUP,
      refreshTokenCiphertext: "existing-cipher",
      retainedExistingRefreshToken: true,
      retainedExistingScopes: false,
    });
  });

  it("B: replaces the refresh token when reconnect returns combined scopes and a new refresh token", () => {
    const resolved = resolveGoogleGrantReplacement({
      existingScopes: SETUP,
      existingRefreshCiphertext: "existing-cipher",
      returnedScopes: SETUP,
      newRefreshCiphertext: "new-combined-cipher",
    });

    expect(resolved).toEqual({
      scopes: SETUP,
      refreshTokenCiphertext: "new-combined-cipher",
      retainedExistingRefreshToken: false,
      retainedExistingScopes: false,
    });
  });

  it("C: does not replace a wider credential with a narrower refresh token and readonly scopes", () => {
    const resolved = resolveGoogleGrantReplacement({
      existingScopes: SETUP,
      existingRefreshCiphertext: "existing-cipher",
      returnedScopes: READONLY,
      newRefreshCiphertext: "narrow-cipher",
    });

    expect(resolved).toEqual({
      scopes: SETUP,
      refreshTokenCiphertext: "existing-cipher",
      retainedExistingRefreshToken: true,
      retainedExistingScopes: true,
    });
    expect(resolved?.refreshTokenCiphertext).not.toBe("narrow-cipher");
    expect(resolved?.scopes).not.toContain("webmasters.readonly");
    expect(resolved?.scopes).toContain("https://www.googleapis.com/auth/webmasters");
    expect(resolved?.scopes).toContain(
      "https://www.googleapis.com/auth/siteverification.verify_only",
    );
  });

  it("D: keeps the existing wider credential when reconnect returns readonly scopes and no refresh token", () => {
    const resolved = resolveGoogleGrantReplacement({
      existingScopes: SETUP,
      existingRefreshCiphertext: "existing-cipher",
      returnedScopes: READONLY,
      newRefreshCiphertext: null,
    });

    expect(resolved).toEqual({
      scopes: SETUP,
      refreshTokenCiphertext: "existing-cipher",
      retainedExistingRefreshToken: true,
      retainedExistingScopes: true,
    });
  });

  it("E: persists the first ordinary grant when no existing token is present", () => {
    const resolved = resolveGoogleGrantReplacement({
      existingScopes: null,
      existingRefreshCiphertext: null,
      returnedScopes: READONLY,
      newRefreshCiphertext: "first-cipher",
    });

    expect(resolved).toEqual({
      scopes: READONLY,
      refreshTokenCiphertext: "first-cipher",
      retainedExistingRefreshToken: false,
      retainedExistingScopes: false,
    });
  });

  it("E: fails closed when the first connection omits a refresh token", () => {
    expect(
      resolveGoogleGrantReplacement({
        existingScopes: null,
        existingRefreshCiphertext: null,
        returnedScopes: READONLY,
        newRefreshCiphertext: null,
      }),
    ).toBeNull();
  });

  it("F: persists a partial setup grant when no wider credential exists", () => {
    const resolved = resolveGoogleGrantReplacement({
      existingScopes: READONLY,
      existingRefreshCiphertext: "existing-cipher",
      returnedScopes: WRITE_ONLY,
      newRefreshCiphertext: "setup-partial-cipher",
    });

    expect(resolved).toEqual({
      scopes: WRITE_ONLY,
      refreshTokenCiphertext: "setup-partial-cipher",
      retainedExistingRefreshToken: false,
      retainedExistingScopes: false,
    });
  });

  it("F: does not keep false-positive setup capabilities from a partial grant", () => {
    const resolved = resolveGoogleGrantReplacement({
      existingScopes: null,
      existingRefreshCiphertext: null,
      returnedScopes: WRITE_ONLY,
      newRefreshCiphertext: "partial-cipher",
    });

    expect(resolved?.scopes).toBe(WRITE_ONLY);
    expect(resolved?.scopes).not.toContain("siteverification");
  });

  it("G: treats a revoked existing credential as absent and persists the new truthful grant", () => {
    const resolved = resolveGoogleGrantReplacement({
      existingScopes: SETUP,
      existingRefreshCiphertext: "revoked",
      returnedScopes: READONLY,
      newRefreshCiphertext: "replacement-cipher",
    });

    expect(resolved).toEqual({
      scopes: READONLY,
      refreshTokenCiphertext: "replacement-cipher",
      retainedExistingRefreshToken: false,
      retainedExistingScopes: false,
    });
  });

  it("G: fails closed when the existing credential is unusable and Google omits a refresh token", () => {
    expect(
      resolveGoogleGrantReplacement({
        existingScopes: SETUP,
        existingRefreshCiphertext: "revoked",
        returnedScopes: READONLY,
        newRefreshCiphertext: null,
      }),
    ).toBeNull();
  });

  it("compares capabilities, not scope count or string length", () => {
    const shortWrite = "https://www.googleapis.com/auth/webmasters";
    const longReadonly =
      "email openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/webmasters.readonly";
    expect(longReadonly.length).toBeGreaterThan(shortWrite.length);
    expect(returnedGrantLacksExistingCapabilities(shortWrite, longReadonly)).toBe(true);
    expect(returnedGrantLacksExistingCapabilities(longReadonly, shortWrite)).toBe(false);
  });

  it("does not invent a combined grant by unioning old and new scope strings", () => {
    const resolved = resolveGoogleGrantReplacement({
      existingScopes: SETUP,
      existingRefreshCiphertext: "existing-cipher",
      returnedScopes: READONLY,
      newRefreshCiphertext: "narrow-cipher",
    });

    expect(resolved?.scopes).toBe(SETUP);
    expect(resolved?.scopes).not.toBe(
      persistableGrantedScopeString(`${SETUP} ${READONLY}`),
    );
    expect(returnedGrantLacksExistingCapabilities(SETUP, READONLY)).toBe(true);
    expect(returnedGrantLacksExistingCapabilities(SETUP, SETUP)).toBe(false);
    expect(returnedGrantLacksExistingCapabilities(READONLY, SETUP)).toBe(false);
  });
});
