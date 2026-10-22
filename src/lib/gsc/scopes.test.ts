import { describe, expect, it } from "vitest";
import {
  GOOGLE_SITE_VERIFICATION_SCOPE,
  GOOGLE_SITE_VERIFICATION_VERIFY_ONLY_SCOPE,
  GOOGLE_WEBMASTERS_READONLY_SCOPE,
  GOOGLE_WEBMASTERS_SCOPE,
  googleCapabilitiesFromScopes,
  hasSearchPresenceSetupCapabilities,
  persistableGrantedScopeString,
} from "./scopes";

describe("Google granted-scope capabilities", () => {
  it("normalizes granted scopes deterministically", () => {
    expect(
      persistableGrantedScopeString(
        ` ${GOOGLE_WEBMASTERS_SCOPE}  openid ${GOOGLE_WEBMASTERS_SCOPE}\nemail `,
      ),
    ).toBe(`email ${GOOGLE_WEBMASTERS_SCOPE} openid`);
  });

  it("treats webmasters.readonly as Search Console read capability only", () => {
    const capabilities = googleCapabilitiesFromScopes(
      `openid email ${GOOGLE_WEBMASTERS_READONLY_SCOPE}`,
    );
    expect(capabilities).toEqual({
      canReadSearchConsole: true,
      canWriteSearchConsole: false,
      canVerifyNewOwnership: false,
    });
    expect(hasSearchPresenceSetupCapabilities(`openid ${GOOGLE_WEBMASTERS_READONLY_SCOPE}`)).toBe(
      false,
    );
  });

  it("treats webmasters as both read and write Search Console capability", () => {
    const capabilities = googleCapabilitiesFromScopes(GOOGLE_WEBMASTERS_SCOPE);
    expect(capabilities.canReadSearchConsole).toBe(true);
    expect(capabilities.canWriteSearchConsole).toBe(true);
    expect(capabilities.canVerifyNewOwnership).toBe(false);
  });

  it("treats verify_only as ownership-verification capability", () => {
    expect(
      googleCapabilitiesFromScopes(GOOGLE_SITE_VERIFICATION_VERIFY_ONLY_SCOPE)
        .canVerifyNewOwnership,
    ).toBe(true);
  });

  it("treats already-granted full siteverification as verification capability", () => {
    expect(
      googleCapabilitiesFromScopes(GOOGLE_SITE_VERIFICATION_SCOPE).canVerifyNewOwnership,
    ).toBe(true);
  });

  it("does not treat denied or partial setup scopes as granted", () => {
    expect(
      hasSearchPresenceSetupCapabilities(
        `openid email ${GOOGLE_WEBMASTERS_SCOPE}`,
      ),
    ).toBe(false);
    expect(
      hasSearchPresenceSetupCapabilities(GOOGLE_SITE_VERIFICATION_VERIFY_ONLY_SCOPE),
    ).toBe(false);
    expect(googleCapabilitiesFromScopes("").canReadSearchConsole).toBe(false);
  });

  it("requires write and verification together for C0 setup", () => {
    expect(
      hasSearchPresenceSetupCapabilities(
        `${GOOGLE_WEBMASTERS_SCOPE} ${GOOGLE_SITE_VERIFICATION_VERIFY_ONLY_SCOPE}`,
      ),
    ).toBe(true);
    expect(
      hasSearchPresenceSetupCapabilities(
        `${GOOGLE_WEBMASTERS_SCOPE} ${GOOGLE_SITE_VERIFICATION_SCOPE}`,
      ),
    ).toBe(true);
  });
});
