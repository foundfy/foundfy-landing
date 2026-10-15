import { describe, expect, it, vi } from "vitest";
import { executeResearchLedger } from "./execute";
import { ResearchProviderError } from "./errors";
import { createFencedResearchStore } from "./fence";
import { buildRequestPlan, classifyLedgerReplay } from "./ledger";
import { FixtureResearchProvider } from "./provider/fixture";
import { researchRequestKey } from "./request-key";
import type { ResearchIdeaRecord, ResearchRequestLedgerEntry, ResearchRunRecord } from "./types";

function baseRun(ledger: ResearchRequestLedgerEntry[]): ResearchRunRecord {
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
    offeringSeeds: ledger.map((entry) => entry.seedOffering),
    provider: "fixture",
    providerEnvironment: "fixture",
    status: "running",
    requestFingerprint: "e".repeat(64),
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
  };
}

async function execute(
  run: ResearchRunRecord,
  provider = new FixtureResearchProvider(),
  ideas: ResearchIdeaRecord[] = [],
) {
  const store = createFencedResearchStore({ runs: [run], ideas });
  const related = vi.spyOn(provider, "relatedKeywordIdeas");
  await executeResearchLedger({
    run,
    websiteId: "site-1",
    hostname: "example.com",
    queryKeys: new Set(),
    provider,
    store,
  });
  return { related, run, ideas, store };
}

describe("executeResearchLedger replay safety", () => {
  it("A — crash before first provider call resumes the same pending plan", async () => {
    const ledger = buildRequestPlan({
      offerings: ["silk paint"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    const { related, run } = await execute(baseRun(ledger));
    expect(related).toHaveBeenCalledTimes(1);
    expect(related.mock.calls[0]?.[0]).toMatchObject({ offering: "silk paint", languageCode: "en" });
    expect(run.requestLedger[0]?.requestKey).toBe(researchRequestKey("silk paint", "en"));
    expect(run.status).toBe("completed");
  });

  it("B — never replays an in_flight pair and cannot settle completed", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint", "gutta resist"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    plan[0] = {
      ...plan[0]!,
      status: "in_flight",
      attemptedAt: "2026-10-11T00:00:01.000Z",
    };
    const { related, run } = await execute(baseRun(plan));
    expect(related).toHaveBeenCalledTimes(1);
    expect(related.mock.calls[0]?.[0]).toMatchObject({ offering: "gutta resist" });
    expect(run.requestLedger.find((entry) => entry.seedOffering === "silk paint")?.status).toBe(
      "in_flight",
    );
    expect(run.status).toBe("interrupted");
  });

  it("C — preserves succeeded ideas and does not repeat that pair", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint", "gutta resist"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    plan[0] = {
      ...plan[0]!,
      status: "succeeded",
      attemptedAt: "2026-10-11T00:00:01.000Z",
      providerTaskId: "task-kept",
      ideaCount: 2,
    };
    const { related, run } = await execute(baseRun(plan));
    expect(related).toHaveBeenCalledTimes(1);
    expect(related.mock.calls[0]?.[0]).toMatchObject({ offering: "gutta resist" });
    expect(run.requestLedger.find((entry) => entry.seedOffering === "silk paint")?.providerTaskId).toBe(
      "task-kept",
    );
  });

  it("D — does not repeat a zero_results pair", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    plan[0] = {
      ...plan[0]!,
      status: "zero_results",
      attemptedAt: "2026-10-11T00:00:01.000Z",
      providerTaskId: "task-empty",
    };
    const { related } = await execute(baseRun(plan));
    expect(related).not.toHaveBeenCalled();
  });

  it("E — does not automatically retry a rate-limited pair", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint", "gutta resist"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    plan[0] = {
      ...plan[0]!,
      status: "rate_limited",
      attemptedAt: "2026-10-11T00:00:01.000Z",
      failureCode: "rate_limited",
    };
    plan[1] = { ...plan[1]!, status: "skipped", attemptedAt: null };
    const { related } = await execute(baseRun(plan));
    expect(related).toHaveBeenCalledTimes(1);
    expect(related.mock.calls[0]?.[0]).toMatchObject({ offering: "gutta resist" });
  });

  it("F — >30 days does not make an attempted pair replayable", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-09-01T00:00:00.000Z",
    });
    plan[0] = {
      ...plan[0]!,
      status: "timeout",
      attemptedAt: "2026-09-01T00:00:01.000Z",
      failureCode: "timeout",
    };
    const { related } = await execute(baseRun(plan));
    expect(related).not.toHaveBeenCalled();
  });

  it("H — reordering ledger entries cannot cause a previously attempted request to be sent again", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint", "gutta resist"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    plan[0] = {
      ...plan[0]!,
      status: "failed",
      attemptedAt: "2026-10-11T00:00:01.000Z",
      failureCode: "server_error",
    };
    const reordered = [...plan].reverse();
    expect(classifyLedgerReplay(plan)).toEqual(classifyLedgerReplay(reordered));
    const { related } = await execute(baseRun(reordered));
    expect(related).toHaveBeenCalledTimes(1);
    expect(related.mock.calls[0]?.[0]).toMatchObject({ offering: "gutta resist" });
  });

  it("sets attemptedAt via the request-start RPC before the HTTP call", async () => {
    const order: string[] = [];
    const run = baseRun(
      buildRequestPlan({
        offerings: ["silk paint"],
        languages: ["en"],
        locationCode: 2840,
        requestedAt: "2026-10-11T00:00:00.000Z",
      }),
    );
    const store = createFencedResearchStore({ runs: [run] });
    const originalClaim = store.claimRequest.bind(store);
    store.claimRequest = (input) => {
      const result = originalClaim(input);
      if (result.outcome === "claimed") {
        order.push("attemptedAt");
      }
      return result;
    };
    const provider = new FixtureResearchProvider();
    vi.spyOn(provider, "relatedKeywordIdeas").mockImplementation(async (input) => {
      order.push("network");
      return new FixtureResearchProvider().relatedKeywordIdeas(input);
    });
    await executeResearchLedger({
      run,
      websiteId: "site-1",
      hostname: "example.com",
      queryKeys: new Set(),
      provider,
      store,
    });
    expect(order.indexOf("attemptedAt")).toBeLessThan(order.indexOf("network"));
  });
});

describe("execution generation fencing", () => {
  it("A — stale executor is rejected before the next provider request", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint", "gutta resist"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    const run = baseRun(plan);
    const store = createFencedResearchStore({ runs: [run] });
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas").mockImplementation(async (input) => {
      if (input.offering === "silk paint") {
        run.executionGeneration += 1;
      }
      return new FixtureResearchProvider().relatedKeywordIdeas(input);
    });

    await executeResearchLedger({
      run: { ...run, executionGeneration: 1 },
      websiteId: "site-1",
      hostname: "example.com",
      queryKeys: new Set(),
      provider,
      store,
    });

    expect(related).toHaveBeenCalledTimes(1);
    expect(run.executionGeneration).toBe(2);
    expect(run.requestLedger.find((entry) => entry.seedOffering === "gutta resist")?.status).toBe(
      "pending",
    );
    expect(run.requestLedger.find((entry) => entry.seedOffering === "gutta resist")?.attemptedAt).toBeNull();
  });

  it("B — late stale provider response cannot mutate ledger or ideas", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    const run = baseRun(plan);
    const ideas: ResearchIdeaRecord[] = [];
    const store = createFencedResearchStore({ runs: [run], ideas });
    store.claimRequest({
      runId: run.id,
      websiteId: run.websiteId,
      executionGeneration: 1,
      requestKey: plan[0]!.requestKey,
    });
    run.lastProgressAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    store.recover({ runId: run.id, websiteId: run.websiteId });

    const stale = store.persistResult({
      runId: run.id,
      websiteId: run.websiteId,
      executionGeneration: 1,
      requestKey: plan[0]!.requestKey,
      status: "succeeded",
      providerTaskId: "stale-task",
      ideaCount: 1,
      providerCost: 1,
      failureCode: null,
      ideas: [
        {
          runId: run.id,
          websiteId: run.websiteId,
          seedOffering: "silk paint",
          languageCode: "en",
          providerTaskId: "stale-task",
          keyword: "stale keyword",
          compactKey: "stale keyword",
          estimatedMonthlySearches: 10,
          providerResultOrder: 1,
          initialGscSampleStatus: "not_in_current_gsc_sample",
          requestKey: plan[0]!.requestKey,
        },
      ],
    });

    expect(stale.outcome).toBe("superseded");
    expect(ideas).toHaveLength(0);
    expect(run.requestLedger[0]?.status).toBe("in_flight");
    expect(run.requestLedger[0]?.providerTaskId).toBeNull();
    expect(store.finalize({
      runId: run.id,
      websiteId: run.websiteId,
      executionGeneration: 1,
      status: "completed",
      providerCost: 1,
      failureCode: null,
      failureMessage: null,
      completedAt: new Date().toISOString(),
    }).outcome).toBe("superseded");
    expect(run.status).toBe("running");
  });

  it("C — stale finalize is rejected after takeover", async () => {
    const run = baseRun([]);
    run.status = "running";
    const store = createFencedResearchStore({ runs: [run] });
    store.recover({ runId: run.id, websiteId: run.websiteId });
    expect(
      store.finalize({
        runId: run.id,
        websiteId: run.websiteId,
        executionGeneration: 1,
        status: "completed",
        providerCost: null,
        failureCode: null,
        failureMessage: null,
        completedAt: new Date().toISOString(),
      }).outcome,
    ).toBe("superseded");
    expect(run.status).toBe("running");
    expect(run.executionGeneration).toBe(2);
  });

  it("D — a later recovery fences the previous recovery executor", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint", "gutta resist"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    const run = baseRun(plan);
    const store = createFencedResearchStore({ runs: [run] });
    expect(store.recover({ runId: run.id, websiteId: run.websiteId }).outcome).toBe("claimed_recovery");
    expect(run.executionGeneration).toBe(2);
    run.lastProgressAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    expect(store.recover({ runId: run.id, websiteId: run.websiteId }).outcome).toBe("claimed_recovery");
    expect(run.executionGeneration).toBe(3);
    expect(
      store.claimRequest({
        runId: run.id,
        websiteId: run.websiteId,
        executionGeneration: 2,
        requestKey: plan[1]!.requestKey,
      }).outcome,
    ).toBe("superseded");
    expect(
      store.persistResult({
        runId: run.id,
        websiteId: run.websiteId,
        executionGeneration: 2,
        requestKey: plan[0]!.requestKey,
        status: "succeeded",
        providerTaskId: "old",
        ideaCount: 0,
        providerCost: null,
        failureCode: null,
        ideas: [],
      }).outcome,
    ).toBe("superseded");
    expect(
      store.finalize({
        runId: run.id,
        websiteId: run.websiteId,
        executionGeneration: 2,
        status: "completed",
        providerCost: null,
        failureCode: null,
        failureMessage: null,
        completedAt: new Date().toISOString(),
      }).outcome,
    ).toBe("superseded");
  });

  it("records genuine provider-empty as zero_results with providerResultCount 0", async () => {
    const provider = new FixtureResearchProvider();
    provider.setBehavior("silk paint", "en", "empty");
    const { run } = await execute(
      baseRun(
        buildRequestPlan({
          offerings: ["silk paint"],
          languages: ["en"],
          locationCode: 2840,
          requestedAt: "2026-10-11T00:00:00.000Z",
        }),
      ),
      provider,
    );
    expect(run.status).toBe("completed");
    expect(run.requestLedger[0]?.status).toBe("zero_results");
    expect(run.requestLedger[0]?.providerResultCount).toBe(0);
    expect(run.requestLedger[0]?.ideaCount).toBe(0);
    expect(run.requestLedger[0]?.filterReasonCounts).toEqual({
      emptyCount: 0,
      invalidCount: 0,
      brandOnlyCount: 0,
      seedDuplicateCount: 0,
      compactDuplicateCount: 0,
      cappedCount: 0,
    });
  });

  it("keeps seed-only provider rows distinguishable from genuine empty", async () => {
    const provider = new FixtureResearchProvider();
    provider.setBehavior("SEO audit for small businesses", "en", "seed_only");
    const { run } = await execute(
      baseRun(
        buildRequestPlan({
          offerings: ["SEO audit for small businesses"],
          languages: ["en"],
          locationCode: 2840,
          requestedAt: "2026-10-11T00:00:00.000Z",
        }),
      ),
      provider,
    );
    expect(run.requestLedger[0]?.status).toBe("zero_results");
    expect(run.requestLedger[0]?.providerResultCount).toBe(1);
    expect(run.requestLedger[0]?.ideaCount).toBe(0);
    expect(run.requestLedger[0]?.filterReasonCounts).toEqual({
      emptyCount: 0,
      invalidCount: 0,
      brandOnlyCount: 0,
      seedDuplicateCount: 1,
      compactDuplicateCount: 0,
      cappedCount: 0,
    });
  });

  it("records useful rows as succeeded with providerResultCount >= ideaCount", async () => {
    const { run } = await execute(
      baseRun(
        buildRequestPlan({
          offerings: ["silk paint"],
          languages: ["en"],
          locationCode: 2840,
          requestedAt: "2026-10-11T00:00:00.000Z",
        }),
      ),
    );
    const entry = run.requestLedger[0];
    expect(entry?.status).toBe("succeeded");
    expect(entry?.ideaCount).toBeGreaterThan(0);
    expect(entry?.providerResultCount).toBeGreaterThanOrEqual(entry?.ideaCount ?? 0);
    expect(entry?.filterReasonCounts).toEqual({
      emptyCount: 0,
      invalidCount: 0,
      brandOnlyCount: 0,
      seedDuplicateCount: 1,
      compactDuplicateCount: 1,
      cappedCount: 0,
    });
    expect(
      (entry?.ideaCount ?? 0) +
        (entry?.filterReasonCounts
          ? Object.values(entry.filterReasonCounts).reduce((sum, count) => sum + count, 0)
          : 0),
    ).toBe(entry?.providerResultCount);
  });

  it("does not persist zero_results when the provider throws invalid_response", async () => {
    const provider = new FixtureResearchProvider();
    vi.spyOn(provider, "relatedKeywordIdeas").mockRejectedValue(
      new ResearchProviderError("invalid_response", "DataForSEO keyword result was missing."),
    );
    const { run } = await execute(
      baseRun(
        buildRequestPlan({
          offerings: ["silk paint"],
          languages: ["en"],
          locationCode: 2840,
          requestedAt: "2026-10-11T00:00:00.000Z",
        }),
      ),
      provider,
    );
    expect(run.requestLedger[0]?.status).toBe("failed");
    expect(run.requestLedger[0]?.failureCode).toBe("invalid_response");
    expect(run.requestLedger[0]?.ideaCount).toBe(0);
    expect(run.requestLedger[0]?.providerResultCount).toBeNull();
    expect(run.requestLedger[0]?.filterReasonCounts).toBeNull();
  });
});
