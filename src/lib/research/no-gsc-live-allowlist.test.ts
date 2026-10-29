import { describe, expect, it } from "vitest";
import {
  isNoGscLiveSpendAllowed,
  parseNoGscLiveAllowlist,
} from "./no-gsc-live-allowlist";

const websiteA = "11111111-1111-4111-8111-111111111111";
const websiteB = "22222222-2222-4222-8222-222222222222";
const identityA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const identityB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("RESEARCH_NO_GSC_LIVE_ALLOWLIST", () => {
  it("fails closed when the env is missing, empty, or malformed", () => {
    expect(parseNoGscLiveAllowlist({}).ok).toBe(false);
    expect(parseNoGscLiveAllowlist({ RESEARCH_NO_GSC_LIVE_ALLOWLIST: "" }).ok).toBe(false);
    expect(parseNoGscLiveAllowlist({ RESEARCH_NO_GSC_LIVE_ALLOWLIST: "   " }).ok).toBe(false);
    expect(
      parseNoGscLiveAllowlist({
        RESEARCH_NO_GSC_LIVE_ALLOWLIST: `${websiteA}:${identityA},not-a-uuid:${identityB}`,
      }).ok,
    ).toBe(false);
    expect(
      parseNoGscLiveAllowlist({
        RESEARCH_NO_GSC_LIVE_ALLOWLIST: `${websiteA}:${identityA},`,
      }).ok,
    ).toBe(false);
    expect(
      parseNoGscLiveAllowlist({
        RESEARCH_NO_GSC_LIVE_ALLOWLIST: `${websiteA}`,
      }).ok,
    ).toBe(false);
    expect(
      isNoGscLiveSpendAllowed({
        websiteId: websiteA,
        googleIdentityId: identityA,
        env: { RESEARCH_NO_GSC_LIVE_ALLOWLIST: `${websiteA}:${identityA},bad` },
      }),
    ).toBe(false);
  });

  it("allows only the exact website and Google identity pair", () => {
    const env = {
      RESEARCH_NO_GSC_LIVE_ALLOWLIST: `${websiteA}:${identityA}`,
    };
    expect(
      isNoGscLiveSpendAllowed({
        websiteId: websiteA,
        googleIdentityId: identityA,
        env,
      }),
    ).toBe(true);
    expect(
      isNoGscLiveSpendAllowed({
        websiteId: websiteB,
        googleIdentityId: identityA,
        env,
      }),
    ).toBe(false);
    expect(
      isNoGscLiveSpendAllowed({
        websiteId: websiteA,
        googleIdentityId: identityB,
        env,
      }),
    ).toBe(false);
    expect(
      isNoGscLiveSpendAllowed({
        websiteId: websiteA,
        googleIdentityId: null,
        env,
      }),
    ).toBe(false);
  });

  it("does not treat request-shaped values as configuration", () => {
    expect(
      isNoGscLiveSpendAllowed({
        websiteId: websiteA,
        googleIdentityId: identityA,
        env: {
          RESEARCH_NO_GSC_LIVE_ALLOWLIST: undefined,
        },
      }),
    ).toBe(false);
  });
});
