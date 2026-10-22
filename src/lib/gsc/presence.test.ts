import { describe, expect, it } from "vitest";
import { deriveSearchPresenceState, hasExactC0DomainUnverifiedProperty } from "./presence";
import { rankGscProperties } from "./match";

describe("derived C0 Search Presence state", () => {
  const website = { hostname: "gez.studio", displayUrl: "https://gez.studio/" };

  it("requires the exact host-Domain unverified property for verification pending", () => {
    const domainUnverified = rankGscProperties(
      [{ siteUrl: "sc-domain:gez.studio", permissionLevel: "siteUnverifiedUser" }],
      website,
    );
    expect(hasExactC0DomainUnverifiedProperty(domainUnverified, website)).toBe(true);
    expect(
      deriveSearchPresenceState({
        boundUsable: false,
        hasCompletedSync: false,
        hasRunningSync: false,
        hasUsableMatchingProperty: false,
        hasExactDomainUnverified: true,
        ownerChoseSetup: true,
        hasSetupCapabilities: true,
      }),
    ).toBe("PROPERTY_ADDED_VERIFICATION_PENDING");
  });

  it("does not treat an unverified URL-prefix property as C0 Domain pending", () => {
    const prefixUnverified = rankGscProperties(
      [{ siteUrl: "https://gez.studio/", permissionLevel: "siteUnverifiedUser" }],
      website,
    );
    expect(hasExactC0DomainUnverifiedProperty(prefixUnverified, website)).toBe(false);
    expect(
      deriveSearchPresenceState({
        boundUsable: false,
        hasCompletedSync: false,
        hasRunningSync: false,
        hasUsableMatchingProperty: false,
        hasExactDomainUnverified: false,
        ownerChoseSetup: false,
        hasSetupCapabilities: false,
      }),
    ).toBe("NO_MATCHING_PROPERTY_IN_CONNECTED_ACCOUNT");
  });

  it("does not treat an unrelated unverified Domain property as C0 pending", () => {
    const other = rankGscProperties(
      [{ siteUrl: "sc-domain:other.example", permissionLevel: "siteUnverifiedUser" }],
      website,
    );
    expect(hasExactC0DomainUnverifiedProperty(other, website)).toBe(false);
  });

  it("prefers a usable matching property over setup or verification", () => {
    expect(
      deriveSearchPresenceState({
        boundUsable: false,
        hasCompletedSync: false,
        hasRunningSync: false,
        hasUsableMatchingProperty: true,
        hasExactDomainUnverified: true,
        ownerChoseSetup: true,
        hasSetupCapabilities: true,
      }),
    ).toBe("MATCHING_GSC_PROPERTY_AVAILABLE");
  });

  it("requires the owner to choose setup before setup auth is required", () => {
    expect(
      deriveSearchPresenceState({
        boundUsable: false,
        hasCompletedSync: false,
        hasRunningSync: false,
        hasUsableMatchingProperty: false,
        hasExactDomainUnverified: false,
        ownerChoseSetup: false,
        hasSetupCapabilities: false,
      }),
    ).toBe("NO_MATCHING_PROPERTY_IN_CONNECTED_ACCOUNT");
    expect(
      deriveSearchPresenceState({
        boundUsable: false,
        hasCompletedSync: false,
        hasRunningSync: false,
        hasUsableMatchingProperty: false,
        hasExactDomainUnverified: false,
        ownerChoseSetup: true,
        hasSetupCapabilities: false,
      }),
    ).toBe("PROPERTY_SETUP_AUTH_REQUIRED");
  });

  it("treats a bound usable property with a completed sync as connected, including empty", () => {
    expect(
      deriveSearchPresenceState({
        boundUsable: true,
        hasCompletedSync: true,
        hasRunningSync: false,
        hasUsableMatchingProperty: true,
        hasExactDomainUnverified: false,
        ownerChoseSetup: false,
        hasSetupCapabilities: true,
      }),
    ).toBe("GSC_CONNECTED");
  });

  it("treats a bound usable property without a completed sync as verified sync pending", () => {
    expect(
      deriveSearchPresenceState({
        boundUsable: true,
        hasCompletedSync: false,
        hasRunningSync: true,
        hasUsableMatchingProperty: true,
        hasExactDomainUnverified: false,
        ownerChoseSetup: false,
        hasSetupCapabilities: true,
      }),
    ).toBe("VERIFIED_SYNC_PENDING");
  });
});
