import { describe, expect, it } from "vitest";
import { isReusableCompletedRun, researchStaleReasons } from "./staleness";
import type { ResearchRunRecord } from "./types";

function run(overrides: Partial<ResearchRunRecord> = {}): ResearchRunRecord {
  return {
    id: "run-1",
    websiteId: "site-1",
    siteModelId: "model-1",
    siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
    requestedBy: "owner-1",
    gscSyncId: "sync-1",
    gscQueriesTruncated: false,
    countryKey: "ES",
    countryName: "Spain",
    locationCode: 2724,
    languageCodes: ["ca"],
    offeringSeeds: ["silk paint"],
    provider: "fixture",
    providerEnvironment: "fixture",
    status: "completed",
    requestFingerprint: "a".repeat(64),
    requestLedger: [],
    providerCost: 0,
    failureCode: null,
    failureMessage: null,
    createdAt: "2026-10-10T00:00:00.000Z",
    startedAt: "2026-10-10T00:00:00.000Z",
    completedAt: "2026-10-10T00:00:01.000Z",
    updatedAt: "2026-10-10T00:00:01.000Z",
    lastProgressAt: "2026-10-10T00:00:01.000Z",
    executionGeneration: 1,
    closedAt: null,
    ...overrides,
  };
}

describe("RESEARCH staleness and reuse", () => {
  it("stales after 30 days, business-context change, or offering change, but not GSC sync alone", () => {
    const old = researchStaleReasons({
      run: run({ completedAt: "2026-08-01T00:00:00.000Z" }),
      confirmedAt: "2026-10-01T00:00:00.000Z",
      confirmedOffers: ["silk paint"],
      latestCompatibleRunId: "run-1",
      now: new Date("2026-10-11T00:00:00.000Z"),
    });
    expect(old).toContain("older_than_30_days");

    const context = researchStaleReasons({
      run: run(),
      confirmedAt: "2026-10-11T00:00:00.000Z",
      confirmedOffers: ["silk paint"],
      latestCompatibleRunId: "run-1",
    });
    expect(context).toContain("business_context_changed");

    const offerings = researchStaleReasons({
      run: run(),
      confirmedAt: "2026-10-01T00:00:00.000Z",
      confirmedOffers: ["gutta"],
      latestCompatibleRunId: "run-1",
    });
    expect(offerings).toContain("offerings_changed");
  });

  it("does not reuse across fingerprints or unfinished runs", () => {
    expect(
      isReusableCompletedRun({
        run: run({ status: "partial" }),
        fingerprint: "a".repeat(64),
        now: new Date("2026-10-11T00:00:00.000Z"),
      }),
    ).toBe(false);
    expect(
      isReusableCompletedRun({
        run: run(),
        fingerprint: "b".repeat(64),
        now: new Date("2026-10-11T00:00:00.000Z"),
      }),
    ).toBe(false);
    expect(
      isReusableCompletedRun({
        run: run(),
        fingerprint: "a".repeat(64),
        now: new Date("2026-10-11T00:00:00.000Z"),
      }),
    ).toBe(true);
  });
});
