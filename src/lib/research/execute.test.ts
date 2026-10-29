import { describe, expect, it, vi } from "vitest";
import { executeResearchLedger } from "./execute";
import { ResearchProviderError } from "./errors";
import { createFencedResearchStore } from "./fence";
import { buildRequestPlan, classifyLedgerReplay } from "./ledger";
import { FixtureResearchProvider } from "./provider/fixture";
import { researchRequestKey } from "./request-key";
import type { ResearchProvider } from "./provider/types";
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

describe("executeResearchLedger GSC queryKeys contract", () => {
  const websiteId = "11111111-1111-4111-8111-111111111111";
  const googleIdentityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  function liveProvider(): ResearchProvider & {
    relatedKeywordIdeas: ReturnType<typeof vi.fn>;
  } {
    return {
      id: "dataforseo",
      environment: "live",
      listCountries: vi.fn(async () => [{ key: "US", name: "United States", locationCode: 2840 }]),
      listLanguages: vi.fn(async () => [{ code: "en", name: "English" }]),
      relatedKeywordIdeas: vi.fn(async () => ({
        taskId: "live-task",
        ideas: [
          { keyword: "silk paint", searchVolume: 12, providerOrder: 0 },
          { keyword: "fixture related term one", searchVolume: 50, providerOrder: 1 },
        ],
        providerCost: 0.01,
        providerResultCount: 2,
      })),
    };
  }

  it("classifies null queryKeys as gsc_unavailable and an empty Set as not in sample", async () => {
    const planInput = {
      offerings: ["silk paint"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    };
    const unavailableRun = {
      ...baseRun(buildRequestPlan(planInput)),
      id: "run-null",
      gscSyncId: null,
    };
    const unavailableIdeas: ResearchIdeaRecord[] = [];
    await executeResearchLedger({
      run: unavailableRun,
      websiteId: "site-1",
      hostname: "example.com",
      queryKeys: null,
      provider: new FixtureResearchProvider(),
      store: createFencedResearchStore({ runs: [unavailableRun], ideas: unavailableIdeas }),
    });
    expect(unavailableIdeas.length).toBeGreaterThan(0);
    expect(unavailableIdeas.every((idea) => idea.initialGscSampleStatus === "gsc_unavailable")).toBe(
      true,
    );

    const emptyRun = { ...baseRun(buildRequestPlan(planInput)), id: "run-empty" };
    const emptySampleIdeas: ResearchIdeaRecord[] = [];
    await executeResearchLedger({
      run: emptyRun,
      websiteId: "site-1",
      hostname: "example.com",
      queryKeys: new Set(),
      provider: new FixtureResearchProvider(),
      store: createFencedResearchStore({ runs: [emptyRun], ideas: emptySampleIdeas }),
    });
    expect(emptySampleIdeas.length).toBeGreaterThan(0);
    expect(
      emptySampleIdeas.every((idea) => idea.initialGscSampleStatus === "not_in_current_gsc_sample"),
    ).toBe(true);
  });

  it("does not reclassify already attempted ledger items", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    const run = baseRun(
      plan.map((entry) => ({
        ...entry,
        status: "succeeded" as const,
        attemptedAt: "2026-10-11T00:00:01.000Z",
        ideaCount: 1,
      })),
    );
    const ideas: ResearchIdeaRecord[] = [
      {
        id: "idea-1",
        runId: run.id,
        websiteId: run.websiteId,
        seedOffering: "silk paint",
        languageCode: "en",
        providerTaskId: "old",
        keyword: "fixture related term one",
        compactKey: "fixture related term one",
        estimatedMonthlySearches: 50,
        providerResultOrder: 1,
        initialGscSampleStatus: "gsc_unavailable",
        requestKey: plan[0]!.requestKey,
        createdAt: "2026-10-11T00:00:01.000Z",
      },
    ];
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");
    await executeResearchLedger({
      run,
      websiteId: run.websiteId,
      hostname: "example.com",
      queryKeys: new Set(["fixture related term one"]),
      provider,
      store: createFencedResearchStore({ runs: [run], ideas }),
    });
    expect(related).not.toHaveBeenCalled();
    expect(ideas[0]?.initialGscSampleStatus).toBe("gsc_unavailable");
  });

  it("denies live null-GSC execution before any provider call", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    const run = { ...baseRun(plan), websiteId, gscSyncId: null, provider: "dataforseo" as const, providerEnvironment: "live" as const };
    const provider = liveProvider();
    await expect(
      executeResearchLedger({
        run,
        websiteId,
        hostname: "example.com",
        queryKeys: null,
        provider,
        ownerGoogleIdentityId: googleIdentityId,
        env: {},
        store: createFencedResearchStore({ runs: [run] }),
      }),
    ).rejects.toMatchObject({ code: "no_gsc_live_not_authorized" });
    expect(provider.relatedKeywordIdeas).not.toHaveBeenCalled();
  });

  it("allows live null-GSC execution when the pair is allowlisted", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    const run = {
      ...baseRun(plan),
      websiteId,
      gscSyncId: null,
      provider: "dataforseo" as const,
      providerEnvironment: "live" as const,
    };
    const provider = liveProvider();
    const ideas: ResearchIdeaRecord[] = [];
    await executeResearchLedger({
      run,
      websiteId,
      hostname: "example.com",
      queryKeys: null,
      provider,
      ownerGoogleIdentityId: googleIdentityId,
      env: { RESEARCH_NO_GSC_LIVE_ALLOWLIST: `${websiteId}:${googleIdentityId}` },
      store: createFencedResearchStore({ runs: [run], ideas }),
    });
    expect(provider.relatedKeywordIdeas).toHaveBeenCalled();
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.every((idea) => idea.initialGscSampleStatus === "gsc_unavailable")).toBe(true);
  });

  function rateLimitedThenSkipped(run: ResearchRunRecord): ResearchRunRecord {
    return {
      ...run,
      requestLedger: [
        {
          ...run.requestLedger[0]!,
          status: "rate_limited",
          attemptedAt: "2026-10-11T00:00:01.000Z",
          failureCode: "rate_limited",
        },
        {
          ...run.requestLedger[1]!,
          status: "skipped",
          attemptedAt: null,
        },
      ],
    };
  }

  it("denies direct live null-GSC execution of skipped unattempted work without authorization", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint", "gutta resist"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    const run = rateLimitedThenSkipped({
      ...baseRun(plan),
      websiteId,
      gscSyncId: null,
      provider: "dataforseo",
      providerEnvironment: "live",
    });
    const provider = liveProvider();
    await expect(
      executeResearchLedger({
        run,
        websiteId,
        hostname: "example.com",
        queryKeys: null,
        provider,
        env: {},
        store: createFencedResearchStore({ runs: [run] }),
      }),
    ).rejects.toMatchObject({ code: "no_gsc_live_not_authorized" });
    expect(provider.relatedKeywordIdeas).not.toHaveBeenCalled();

    const wrongWebsite = liveProvider();
    await expect(
      executeResearchLedger({
        run,
        websiteId,
        hostname: "example.com",
        queryKeys: null,
        provider: wrongWebsite,
        ownerGoogleIdentityId: googleIdentityId,
        env: {
          RESEARCH_NO_GSC_LIVE_ALLOWLIST: `22222222-2222-4222-8222-222222222222:${googleIdentityId}`,
        },
        store: createFencedResearchStore({ runs: [run] }),
      }),
    ).rejects.toMatchObject({ code: "no_gsc_live_not_authorized" });
    expect(wrongWebsite.relatedKeywordIdeas).not.toHaveBeenCalled();

    const wrongIdentity = liveProvider();
    await expect(
      executeResearchLedger({
        run,
        websiteId,
        hostname: "example.com",
        queryKeys: null,
        provider: wrongIdentity,
        ownerGoogleIdentityId: googleIdentityId,
        env: {
          RESEARCH_NO_GSC_LIVE_ALLOWLIST: `${websiteId}:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`,
        },
        store: createFencedResearchStore({ runs: [run] }),
      }),
    ).rejects.toMatchObject({ code: "no_gsc_live_not_authorized" });
    expect(wrongIdentity.relatedKeywordIdeas).not.toHaveBeenCalled();
  });

  it("resumes only skipped unattempted live null-GSC work when the pair is allowlisted", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint", "gutta resist"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    const run = rateLimitedThenSkipped({
      ...baseRun(plan),
      websiteId,
      gscSyncId: null,
      provider: "dataforseo",
      providerEnvironment: "live",
    });
    const provider = liveProvider();
    const ideas: ResearchIdeaRecord[] = [];
    await executeResearchLedger({
      run,
      websiteId,
      hostname: "example.com",
      queryKeys: null,
      provider,
      ownerGoogleIdentityId: googleIdentityId,
      env: { RESEARCH_NO_GSC_LIVE_ALLOWLIST: `${websiteId}:${googleIdentityId}` },
      store: createFencedResearchStore({ runs: [run], ideas }),
    });
    expect(provider.relatedKeywordIdeas).toHaveBeenCalledTimes(1);
    expect(provider.relatedKeywordIdeas.mock.calls[0]?.[0]).toMatchObject({
      offering: "gutta resist",
    });
    expect(run.requestLedger[0]?.status).toBe("rate_limited");
    expect(ideas.every((idea) => idea.initialGscSampleStatus === "gsc_unavailable")).toBe(true);
  });

  it("does not require the no-GSC allowlist for GSC-backed live execution", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint", "gutta resist"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    const run = rateLimitedThenSkipped({
      ...baseRun(plan),
      websiteId,
      provider: "dataforseo",
      providerEnvironment: "live",
    });
    const provider = liveProvider();
    await executeResearchLedger({
      run,
      websiteId,
      hostname: "example.com",
      queryKeys: new Set(),
      provider,
      env: {},
      store: createFencedResearchStore({ runs: [run] }),
    });
    expect(provider.relatedKeywordIdeas).toHaveBeenCalledTimes(1);
  });

  it("does not invent live no-GSC spend when there is no remaining unattempted work", async () => {
    const plan = buildRequestPlan({
      offerings: ["silk paint"],
      languages: ["en"],
      locationCode: 2840,
      requestedAt: "2026-10-11T00:00:00.000Z",
    });
    const run = {
      ...baseRun(
        plan.map((entry) => ({
          ...entry,
          status: "succeeded" as const,
          attemptedAt: "2026-10-11T00:00:01.000Z",
        })),
      ),
      websiteId,
      gscSyncId: null,
      provider: "dataforseo" as const,
      providerEnvironment: "live" as const,
    };
    const provider = liveProvider();
    await executeResearchLedger({
      run,
      websiteId,
      hostname: "example.com",
      queryKeys: null,
      provider,
      env: {},
      store: createFencedResearchStore({ runs: [run] }),
    });
    expect(provider.relatedKeywordIdeas).not.toHaveBeenCalled();
  });
});
