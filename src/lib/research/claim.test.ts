import { describe, expect, it } from "vitest";
import { createSerializedResearchClaim, createSerializedResearchRecovery, selectClaimDecision } from "./claim";
import { RESEARCH_ABANDONED_MS, RESEARCH_REUSE_WINDOW_MS } from "./config";
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
    lastProgressAt: "2026-10-10T00:01:00.000Z",
    executionGeneration: 1,
    closedAt: null,
    ...overrides,
  };
}

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

  it("reuses a completed fingerprint inside 30 days even when stored confirmedAt uses an equivalent offset", () => {
    const decision = selectClaimDecision({
      now,
      runs: [
        run({
          id: "done",
          status: "completed",
          siteModelConfirmedAt: "2026-10-13T09:52:17.945+00:00",
          requestFingerprint: "a".repeat(64),
          completedAt: "2026-10-10T00:01:00.000Z",
        }),
      ],
    });
    expect(decision.kind).toBe("reuse_completed");
    expect(decision.run?.id).toBe("done");
  });

  it("reuses an active requested or running run that still has recent progress", () => {
    const decision = selectClaimDecision({
      now,
      runs: [
        run({
          id: "active",
          status: "running",
          completedAt: null,
          lastProgressAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }),
      ],
    });
    expect(decision.kind).toBe("reuse_active");
  });

  it("requires recovery for an abandoned requested or running run", () => {
    const decision = selectClaimDecision({
      now,
      runs: [
        run({
          id: "abandoned",
          status: "running",
          completedAt: null,
          lastProgressAt: new Date(now.getTime() - RESEARCH_ABANDONED_MS).toISOString(),
        }),
      ],
    });
    expect(decision.kind).toBe("recovery_required");
    expect(decision.run?.id).toBe("abandoned");
  });

  it("requires recovery for interrupted, partial, or failed runs at any age", () => {
    const old = new Date(now.getTime() - RESEARCH_REUSE_WINDOW_MS - 1000).toISOString();
    expect(
      selectClaimDecision({
        now,
        runs: [run({ id: "partial", status: "partial", createdAt: old })],
      }).kind,
    ).toBe("recovery_required");
    expect(
      selectClaimDecision({
        now,
        runs: [run({ id: "failed", status: "failed", createdAt: old })],
      }).kind,
    ).toBe("recovery_required");
    expect(
      selectClaimDecision({
        now,
        runs: [run({ id: "interrupted", status: "interrupted", createdAt: old })],
      }).kind,
    ).toBe("recovery_required");
  });

  it("allows a deliberate new cycle after completed research older than 30 days", () => {
    const decision = selectClaimDecision({
      now,
      runs: [
        run({
          id: "stale",
          status: "completed",
          completedAt: new Date(now.getTime() - RESEARCH_REUSE_WINDOW_MS - 1000).toISOString(),
        }),
      ],
    });
    expect(decision.kind).toBe("claimed");
    expect(decision.run).toBeNull();
  });

  it("claims when no compatible run exists", () => {
    const decision = selectClaimDecision({ now, runs: [] });
    expect(decision.kind).toBe("claimed");
    expect(decision.run).toBeNull();
  });

  it("allows a deliberate new cycle after an owner-closed historical run", () => {
    const decision = selectClaimDecision({
      now,
      runs: [run({ id: "closed", status: "closed", closedAt: now.toISOString() })],
    });
    expect(decision.kind).toBe("claimed");
    expect(decision.run).toBeNull();
  });
});

describe("createSerializedResearchClaim", () => {
  it("serializes two same-fingerprint claims into one insert", async () => {
    const runs: ResearchRunRecord[] = [];
    const serialized = createSerializedResearchClaim({ runs });
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

  it("does not insert a second run when an active run completes during the claim lock", async () => {
    const runs: ResearchRunRecord[] = [
      run({
        id: "running-1",
        status: "running",
        requestFingerprint: insert.requestFingerprint,
        completedAt: null,
        lastProgressAt: "2026-10-11T00:00:00.000Z",
      }),
    ];
    const serialized = createSerializedResearchClaim({
      runs,
      now: new Date("2026-10-11T00:00:00.000Z"),
      afterAcquire: async () => {
        const current = runs[0];
        if (current) {
          current.status = "completed";
          current.completedAt = "2026-10-11T00:00:30.000Z";
        }
      },
    });
    const result = await serialized.claim({
      websiteId: "site-1",
      requestFingerprint: insert.requestFingerprint,
      insert,
    });
    expect(result.kind).toBe("reuse_completed");
    expect(result.run.id).toBe("running-1");
    expect(runs).toHaveLength(1);
  });

  it("lets different fingerprints proceed independently", async () => {
    const runs: ResearchRunRecord[] = [];
    const serialized = createSerializedResearchClaim({ runs });
    const [first, second] = await Promise.all([
      serialized.claim({
        websiteId: "site-1",
        requestFingerprint: "c".repeat(64),
        insert: { ...insert, requestFingerprint: "c".repeat(64) },
      }),
      serialized.claim({
        websiteId: "site-1",
        requestFingerprint: "d".repeat(64),
        insert: { ...insert, requestFingerprint: "d".repeat(64), countryKey: "US" },
      }),
    ]);
    expect(first.kind).toBe("claimed");
    expect(second.kind).toBe("claimed");
    expect(first.run.id).not.toBe(second.run.id);
  });

  it("does not create a fresh same-fingerprint run for zero-attempt interrupted recovery", async () => {
    const runs: ResearchRunRecord[] = [
      run({
        id: "interrupted-1",
        status: "interrupted",
        requestFingerprint: insert.requestFingerprint,
        requestLedger: [],
      }),
    ];
    const serialized = createSerializedResearchClaim({ runs });
    const result = await serialized.claim({
      websiteId: "site-1",
      requestFingerprint: insert.requestFingerprint,
      insert,
    });
    expect(result.kind).toBe("recovery_required");
    expect(result.run.id).toBe("interrupted-1");
    expect(runs).toHaveLength(1);
  });
});

describe("createSerializedResearchRecovery", () => {
  it("lets only one recovery own a run at a time", async () => {
    const runs: ResearchRunRecord[] = [
      run({
        id: "run-1",
        status: "interrupted",
        completedAt: null,
        lastProgressAt: "2026-10-10T00:00:00.000Z",
      }),
    ];
    const serialized = createSerializedResearchRecovery({
      runs,
      now: new Date("2026-10-11T00:00:00.000Z"),
    });
    const [first, second] = await Promise.all([
      serialized.recover({ runId: "run-1", websiteId: "site-1" }),
      serialized.recover({ runId: "run-1", websiteId: "site-1" }),
    ]);
    expect(first.kind).toBe("claimed_recovery");
    expect(second.kind).toBe("recovery_busy");
    expect(first.run?.status).toBe("running");
    expect(first.run?.executionGeneration).toBe(2);
    expect(runs[0]?.executionGeneration).toBe(2);
  });

  it("does not recover a closed run", async () => {
    const runs: ResearchRunRecord[] = [
      run({
        id: "run-1",
        status: "closed",
        closedAt: "2026-10-11T00:00:00.000Z",
      }),
    ];
    const serialized = createSerializedResearchRecovery({
      runs,
      now: new Date("2026-10-11T00:00:00.000Z"),
    });
    const result = await serialized.recover({ runId: "run-1", websiteId: "site-1" });
    expect(result.kind).toBe("not_recoverable");
  });

  it("rejects stale-generation finalization after a newer owner exists", async () => {
    const runs: ResearchRunRecord[] = [
      run({
        id: "run-1",
        status: "running",
        completedAt: null,
        executionGeneration: 2,
      }),
    ];
    const serialized = createSerializedResearchClaim({
      runs,
      now: new Date("2026-10-11T00:00:00.000Z"),
    });
    await expect(
      serialized.finalize({
        id: "run-1",
        executionGeneration: 1,
        status: "completed",
        completedAt: "2026-10-11T00:00:30.000Z",
      }),
    ).rejects.toThrow(/execution_superseded/);
    expect(runs[0]?.status).toBe("running");
  });

  it("refuses recovery while a normal executor still owns the run", async () => {
    const now = new Date("2026-10-11T00:00:00.000Z");
    const runs: ResearchRunRecord[] = [
      run({
        id: "run-1",
        status: "running",
        completedAt: null,
        lastProgressAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }),
    ];
    const serialized = createSerializedResearchRecovery({ runs, now });
    const result = await serialized.recover({ runId: "run-1", websiteId: "site-1" });
    expect(result.kind).toBe("recovery_busy");
  });
});
