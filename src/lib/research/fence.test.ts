import { describe, expect, it } from "vitest";
import { createFencedResearchStore } from "./fence";
import { buildRequestPlan } from "./ledger";
import { researchRequestKey } from "./request-key";
import type { ResearchIdeaRecord, ResearchRunRecord } from "./types";

function run(overrides: Partial<ResearchRunRecord> = {}): ResearchRunRecord {
  const ledger = buildRequestPlan({
    offerings: ["silk paint", "gutta resist"],
    languages: ["en"],
    locationCode: 2840,
    requestedAt: "2026-10-11T00:00:00.000Z",
  });
  return {
    id: "run-1",
    websiteId: "site-1",
    siteModelId: "model-1",
    siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
    requestedBy: "owner-1",
    gscSyncId: "sync-1",
    gscQueriesTruncated: false,
    countryKey: "US",
    countryName: "United States",
    locationCode: 2840,
    languageCodes: ["en"],
    offeringSeeds: ["silk paint", "gutta resist"],
    provider: "fixture",
    providerEnvironment: "fixture",
    status: "running",
    requestFingerprint: "a".repeat(64),
    requestLedger: ledger,
    providerCost: null,
    failureCode: null,
    failureMessage: null,
    createdAt: "2026-10-10T00:00:00.000Z",
    startedAt: "2026-10-10T00:00:00.000Z",
    completedAt: null,
    updatedAt: "2026-10-10T00:00:00.000Z",
    lastProgressAt: "2026-10-10T00:00:00.000Z",
    executionGeneration: 1,
    closedAt: null,
    ...overrides,
  };
}

function ideaInsert(input: {
  run: ResearchRunRecord;
  requestKey: string;
  keyword: string;
  offering?: string;
  language?: string;
}) {
  return {
    runId: input.run.id,
    websiteId: input.run.websiteId,
    seedOffering: input.offering ?? "silk paint",
    languageCode: input.language ?? "en",
    providerTaskId: "task-1",
    keyword: input.keyword,
    compactKey: input.keyword,
    estimatedMonthlySearches: 10,
    providerResultOrder: 1,
    initialGscSampleStatus: "not_in_current_gsc_sample" as const,
    requestKey: input.requestKey,
  };
}

describe("fenced request start", () => {
  it("allows pending or skipped unattempted pairs for the current generation only", () => {
    const rec = run();
    const store = createFencedResearchStore({ runs: [rec] });
    const pendingKey = rec.requestLedger[0]!.requestKey;
    rec.requestLedger[1] = { ...rec.requestLedger[1]!, status: "skipped", attemptedAt: null };
    expect(
      store.claimRequest({
        runId: rec.id,
        websiteId: rec.websiteId,
        executionGeneration: 1,
        requestKey: pendingKey,
      }).outcome,
    ).toBe("claimed");
    expect(rec.requestLedger[0]?.status).toBe("in_flight");
    expect(rec.requestLedger[0]?.attemptedAt).toBeTruthy();
    expect(
      store.claimRequest({
        runId: rec.id,
        websiteId: rec.websiteId,
        executionGeneration: 1,
        requestKey: rec.requestLedger[1]!.requestKey,
      }).outcome,
    ).toBe("claimed");
  });

  it("never starts attempted, in_flight, terminal, or stale-generation pairs", () => {
    const rec = run();
    rec.requestLedger[0] = {
      ...rec.requestLedger[0]!,
      status: "in_flight",
      attemptedAt: "2026-10-11T00:00:01.000Z",
    };
    rec.requestLedger[1] = {
      ...rec.requestLedger[1]!,
      status: "succeeded",
      attemptedAt: "2026-10-11T00:00:01.000Z",
    };
    const extra = run({
      id: "run-2",
      requestLedger: buildRequestPlan({
        offerings: ["silk paint"],
        languages: ["ca"],
        locationCode: 2840,
        requestedAt: "2026-10-11T00:00:00.000Z",
      }).map((entry) => ({
        ...entry,
        status: "zero_results" as const,
        attemptedAt: "2026-10-11T00:00:01.000Z",
      })),
    });
    const store = createFencedResearchStore({ runs: [rec, extra] });
    expect(
      store.claimRequest({
        runId: rec.id,
        websiteId: rec.websiteId,
        executionGeneration: 1,
        requestKey: rec.requestLedger[0]!.requestKey,
      }).outcome,
    ).toBe("already_attempted");
    expect(
      store.claimRequest({
        runId: rec.id,
        websiteId: rec.websiteId,
        executionGeneration: 1,
        requestKey: rec.requestLedger[1]!.requestKey,
      }).outcome,
    ).toBe("already_attempted");
    expect(
      store.claimRequest({
        runId: extra.id,
        websiteId: extra.websiteId,
        executionGeneration: 1,
        requestKey: extra.requestLedger[0]!.requestKey,
      }).outcome,
    ).toBe("already_attempted");
    rec.executionGeneration = 2;
    expect(
      store.claimRequest({
        runId: rec.id,
        websiteId: rec.websiteId,
        executionGeneration: 1,
        requestKey: rec.requestLedger[0]!.requestKey,
      }).outcome,
    ).toBe("superseded");
  });
});

describe("fenced result persistence", () => {
  it("persists current-generation success, zero results, and rejects stale writes", () => {
    const rec = run();
    const ideas: ResearchIdeaRecord[] = [];
    const store = createFencedResearchStore({ runs: [rec], ideas });
    const key = rec.requestLedger[0]!.requestKey;
    store.claimRequest({
      runId: rec.id,
      websiteId: rec.websiteId,
      executionGeneration: 1,
      requestKey: key,
    });
    expect(
      store.persistResult({
        runId: rec.id,
        websiteId: rec.websiteId,
        executionGeneration: 1,
        requestKey: key,
        status: "succeeded",
        providerTaskId: "task-ok",
        ideaCount: 1,
        providerCost: 0.1,
        failureCode: null,
        ideas: [ideaInsert({ run: rec, requestKey: key, keyword: "related silk" })],
      }).outcome,
    ).toBe("persisted");
    expect(ideas).toHaveLength(1);
    expect(rec.requestLedger[0]?.status).toBe("succeeded");
    expect(rec.requestLedger[0]?.providerTaskId).toBe("task-ok");

    const emptyKey = rec.requestLedger[1]!.requestKey;
    store.claimRequest({
      runId: rec.id,
      websiteId: rec.websiteId,
      executionGeneration: 1,
      requestKey: emptyKey,
    });
    store.persistResult({
      runId: rec.id,
      websiteId: rec.websiteId,
      executionGeneration: 1,
      requestKey: emptyKey,
      status: "zero_results",
      providerTaskId: "task-empty",
      ideaCount: 0,
      providerCost: null,
      failureCode: null,
      ideas: [],
    });
    expect(rec.requestLedger[1]?.status).toBe("zero_results");
    expect(ideas).toHaveLength(1);

    rec.executionGeneration = 2;
    expect(
      store.persistResult({
        runId: rec.id,
        websiteId: rec.websiteId,
        executionGeneration: 1,
        requestKey: key,
        status: "failed",
        providerTaskId: "stale",
        ideaCount: 0,
        providerCost: null,
        failureCode: "server_error",
        ideas: [],
      }).outcome,
    ).toBe("superseded");
    expect(rec.requestLedger[0]?.status).toBe("succeeded");
  });

  it("does not duplicate ideas on a second persist of the same run/requestKey/compact key", () => {
    const rec = run();
    const ideas: ResearchIdeaRecord[] = [];
    const store = createFencedResearchStore({ runs: [rec], ideas });
    const key = rec.requestLedger[0]!.requestKey;
    store.claimRequest({
      runId: rec.id,
      websiteId: rec.websiteId,
      executionGeneration: 1,
      requestKey: key,
    });
    const row = ideaInsert({ run: rec, requestKey: key, keyword: "related silk" });
    store.persistResult({
      runId: rec.id,
      websiteId: rec.websiteId,
      executionGeneration: 1,
      requestKey: key,
      status: "succeeded",
      providerTaskId: "task-ok",
      ideaCount: 1,
      providerCost: null,
      failureCode: null,
      ideas: [row],
    });
    store.persistResult({
      runId: rec.id,
      websiteId: rec.websiteId,
      executionGeneration: 1,
      requestKey: key,
      status: "succeeded",
      providerTaskId: "task-ok",
      ideaCount: 1,
      providerCost: null,
      failureCode: null,
      ideas: [row],
    });
    expect(ideas).toHaveLength(1);
  });

  it("keeps the same keyword from different offerings or languages as separate evidence", () => {
    const rec = run({
      requestLedger: [
        ...buildRequestPlan({
          offerings: ["silk paint"],
          languages: ["en"],
          locationCode: 2840,
          requestedAt: "2026-10-11T00:00:00.000Z",
        }),
        ...buildRequestPlan({
          offerings: ["gutta resist"],
          languages: ["en"],
          locationCode: 2840,
          requestedAt: "2026-10-11T00:00:00.000Z",
        }),
      ],
    });
    const ideas: ResearchIdeaRecord[] = [];
    const store = createFencedResearchStore({ runs: [rec], ideas });
    const firstKey = researchRequestKey("silk paint", "en");
    const secondKey = researchRequestKey("gutta resist", "en");
    store.claimRequest({
      runId: rec.id,
      websiteId: rec.websiteId,
      executionGeneration: 1,
      requestKey: firstKey,
    });
    store.persistResult({
      runId: rec.id,
      websiteId: rec.websiteId,
      executionGeneration: 1,
      requestKey: firstKey,
      status: "succeeded",
      providerTaskId: "t1",
      ideaCount: 1,
      providerCost: null,
      failureCode: null,
      ideas: [ideaInsert({ run: rec, requestKey: firstKey, keyword: "silk dye", offering: "silk paint" })],
    });
    store.claimRequest({
      runId: rec.id,
      websiteId: rec.websiteId,
      executionGeneration: 1,
      requestKey: secondKey,
    });
    store.persistResult({
      runId: rec.id,
      websiteId: rec.websiteId,
      executionGeneration: 1,
      requestKey: secondKey,
      status: "succeeded",
      providerTaskId: "t2",
      ideaCount: 1,
      providerCost: null,
      failureCode: null,
      ideas: [
        ideaInsert({
          run: rec,
          requestKey: secondKey,
          keyword: "silk dye",
          offering: "gutta resist",
        }),
      ],
    });
    expect(ideas).toHaveLength(2);
    expect(new Set(ideas.map((row) => row.requestKey)).size).toBe(2);
  });
});

describe("close_research_run fencing", () => {
  it("closes interrupted, partial, and failed runs without changing attempted pairs", () => {
    const rec = run({
      status: "interrupted",
      requestLedger: buildRequestPlan({
        offerings: ["silk paint"],
        languages: ["en"],
        locationCode: 2840,
        requestedAt: "2026-10-11T00:00:00.000Z",
      }).map((entry) => ({
        ...entry,
        status: "in_flight" as const,
        attemptedAt: "2026-10-11T00:00:01.000Z",
      })),
    });
    const attemptedAt = rec.requestLedger[0]!.attemptedAt;
    const store = createFencedResearchStore({ runs: [rec] });
    expect(store.close({ runId: rec.id, websiteId: rec.websiteId }).outcome).toBe("closed");
    expect(rec.status).toBe("closed");
    expect(rec.closedAt).toBeTruthy();
    expect(rec.requestLedger[0]?.attemptedAt).toBe(attemptedAt);
    expect(rec.requestLedger[0]?.status).toBe("in_flight");
    expect(store.close({ runId: rec.id, websiteId: rec.websiteId }).outcome).toBe("already_closed");
  });

  it("rejects close while an active executor owns the run or the run is completed", () => {
    const active = run({ status: "running", lastProgressAt: new Date().toISOString() });
    const done = run({ id: "done", status: "completed", completedAt: new Date().toISOString() });
    const store = createFencedResearchStore({ runs: [active, done] });
    expect(store.close({ runId: active.id, websiteId: active.websiteId }).outcome).toBe("recovery_busy");
    expect(store.close({ runId: done.id, websiteId: done.websiteId }).outcome).toBe("not_closeable");
  });
});
