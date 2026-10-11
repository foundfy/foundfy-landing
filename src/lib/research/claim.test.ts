import { describe, expect, it } from "vitest";
import { createSerializedResearchClaim, selectClaimDecision } from "./claim";
import type { ResearchRunRecord } from "./types";

function run(overrides: Partial<ResearchRunRecord>): ResearchRunRecord {
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
    languageCodes: ["en"],
    offeringSeeds: ["silk paint"],
    provider: "fixture",
    providerEnvironment: "fixture",
    status: "completed",
    requestFingerprint: "a".repeat(64),
    requestLedger: [],
    providerCost: null,
    failureCode: null,
    failureMessage: null,
    createdAt: "2026-10-10T00:00:00.000Z",
    startedAt: "2026-10-10T00:00:00.000Z",
    completedAt: "2026-10-10T00:01:00.000Z",
    updatedAt: "2026-10-10T00:01:00.000Z",
    ...overrides,
  };
}

describe("selectClaimDecision", () => {
  const now = new Date("2026-10-11T00:00:00.000Z");

  it("reuses a completed compatible run inside 30 days first", () => {
    const decision = selectClaimDecision({
      now,
      runs: [
        run({ id: "active", status: "running", completedAt: null }),
        run({ id: "done", status: "completed" }),
      ],
    });
    expect(decision.kind).toBe("reuse_completed");
    expect(decision.run?.id).toBe("done");
  });

  it("reuses an active requested or running run", () => {
    const decision = selectClaimDecision({
      now,
      runs: [run({ id: "active", status: "running", completedAt: null })],
    });
    expect(decision.kind).toBe("reuse_active");
  });

  it("blocks retry of a recent partial or failed run", () => {
    const decision = selectClaimDecision({
      now,
      runs: [run({ id: "partial", status: "partial" })],
    });
    expect(decision.kind).toBe("block_retry");
  });

  it("claims when no compatible run exists", () => {
    const decision = selectClaimDecision({ now, runs: [] });
    expect(decision.kind).toBe("claimed");
    expect(decision.run).toBeNull();
  });
});

describe("createSerializedResearchClaim", () => {
  it("serializes two same-fingerprint claims into one insert", async () => {
    const runs: ResearchRunRecord[] = [];
    const serialized = createSerializedResearchClaim({ runs });
    const insert = {
      websiteId: "site-1",
      siteModelId: "model-1",
      siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
      requestedBy: "owner-1",
      gscSyncId: "sync-1",
      gscQueriesTruncated: false,
      countryKey: "ES",
      countryName: "Spain",
      locationCode: 2724,
      languageCodes: ["en"],
      offeringSeeds: ["silk paint"],
      provider: "fixture" as const,
      providerEnvironment: "fixture" as const,
      requestFingerprint: "b".repeat(64),
    };
    const [first, second] = await Promise.all([
      serialized.claim({
        websiteId: "site-1",
        requestFingerprint: insert.requestFingerprint,
        insert,
      }),
      serialized.claim({
        websiteId: "site-1",
        requestFingerprint: insert.requestFingerprint,
        insert,
      }),
    ]);
    expect(first.kind).toBe("claimed");
    expect(second.kind).toBe("reuse_active");
    expect(second.run.id).toBe(first.run.id);
    expect(runs).toHaveLength(1);
  });

  it("lets different fingerprints proceed independently", async () => {
    const runs: ResearchRunRecord[] = [];
    const serialized = createSerializedResearchClaim({ runs });
    const base = {
      websiteId: "site-1",
      siteModelId: "model-1",
      siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
      requestedBy: "owner-1",
      gscSyncId: "sync-1",
      gscQueriesTruncated: false,
      countryKey: "ES",
      countryName: "Spain",
      locationCode: 2724,
      languageCodes: ["en"],
      offeringSeeds: ["silk paint"],
      provider: "fixture" as const,
      providerEnvironment: "fixture" as const,
    };
    const [first, second] = await Promise.all([
      serialized.claim({
        websiteId: "site-1",
        requestFingerprint: "c".repeat(64),
        insert: { ...base, requestFingerprint: "c".repeat(64) },
      }),
      serialized.claim({
        websiteId: "site-1",
        requestFingerprint: "d".repeat(64),
        insert: { ...base, requestFingerprint: "d".repeat(64), countryKey: "US" },
      }),
    ]);
    expect(first.kind).toBe("claimed");
    expect(second.kind).toBe("claimed");
    expect(first.run.id).not.toBe(second.run.id);
  });
});
