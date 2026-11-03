import { describe, expect, it } from "vitest";
import {
  GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV,
  isGoogleIndexingPilotAllowed,
  parseGoogleIndexingPilotAllowlist,
} from "./indexing-pilot";

const websiteA = "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2";
const websiteB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const identityA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const identityB = "11111111-1111-4111-8111-111111111111";

describe("GOOGLE_INDEXING_PILOT_ALLOWLIST", () => {
  it("fails closed when the env is missing, empty, or malformed", () => {
    expect(parseGoogleIndexingPilotAllowlist({}).ok).toBe(false);
    expect(parseGoogleIndexingPilotAllowlist({ [GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV]: "" }).ok).toBe(
      false,
    );
    expect(
      parseGoogleIndexingPilotAllowlist({ [GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV]: "   " }).ok,
    ).toBe(false);
    expect(
      parseGoogleIndexingPilotAllowlist({
        [GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV]: `${websiteA}:${identityA},not-a-uuid:${identityB}`,
      }).ok,
    ).toBe(false);
    expect(
      parseGoogleIndexingPilotAllowlist({
        [GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV]: `${websiteA}:${identityA},`,
      }).ok,
    ).toBe(false);
    expect(
      parseGoogleIndexingPilotAllowlist({
        [GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV]: `${websiteA}`,
      }).ok,
    ).toBe(false);
    expect(
      isGoogleIndexingPilotAllowed({
        websiteId: websiteA,
        googleIdentityId: identityA,
        env: { [GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV]: `${websiteA}:${identityA},bad` },
      }),
    ).toBe(false);
  });

  it("allows only the exact website and Google identity pair", () => {
    const env = {
      [GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV]: `${websiteA}:${identityA}`,
    };
    expect(
      isGoogleIndexingPilotAllowed({
        websiteId: websiteA,
        googleIdentityId: identityA,
        env,
      }),
    ).toBe(true);
    expect(
      isGoogleIndexingPilotAllowed({
        websiteId: websiteB,
        googleIdentityId: identityA,
        env,
      }),
    ).toBe(false);
    expect(
      isGoogleIndexingPilotAllowed({
        websiteId: websiteA,
        googleIdentityId: identityB,
        env,
      }),
    ).toBe(false);
    expect(
      isGoogleIndexingPilotAllowed({
        websiteId: websiteA,
        googleIdentityId: null,
        env,
      }),
    ).toBe(false);
  });
});
