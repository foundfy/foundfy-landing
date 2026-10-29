import { beforeEach, describe, expect, it, vi } from "vitest";

const requireObserveOwnerMock = vi.fn();
const findResearchRunForWebsiteMock = vi.fn();
const claimResearchRecoveryMock = vi.fn();
const persistResearchRequestPlanMock = vi.fn();
const claimResearchRequestMock = vi.fn();
const persistResearchRequestResultMock = vi.fn();
const skipUnattemptedResearchRequestsMock = vi.fn();
const finalizeFencedResearchRunMock = vi.fn();
const loadResearchForOwnerMock = vi.fn();
const listCompletedSearchSyncsForWebsiteMock = vi.fn();
const listEvidenceForSyncMock = vi.fn();
const findSearchSyncByIdMock = vi.fn();

vi.mock("@/lib/gsc/observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwnerMock(...args),
}));

vi.mock("@/lib/gsc/db-search", () => ({
  listCompletedSearchSyncsForWebsite: (...args: unknown[]) =>
    listCompletedSearchSyncsForWebsiteMock(...args),
  listEvidenceForSync: (...args: unknown[]) => listEvidenceForSyncMock(...args),
  findSearchSyncById: (...args: unknown[]) => findSearchSyncByIdMock(...args),
}));

vi.mock("./repository", () => ({
  findResearchRunForWebsite: (...args: unknown[]) => findResearchRunForWebsiteMock(...args),
  claimResearchRecovery: (...args: unknown[]) => claimResearchRecoveryMock(...args),
  persistResearchRequestPlan: (...args: unknown[]) => persistResearchRequestPlanMock(...args),
  claimResearchRequest: (...args: unknown[]) => claimResearchRequestMock(...args),
  persistResearchRequestResult: (...args: unknown[]) => persistResearchRequestResultMock(...args),
  skipUnattemptedResearchRequests: (...args: unknown[]) =>
    skipUnattemptedResearchRequestsMock(...args),
  finalizeFencedResearchRun: (...args: unknown[]) => finalizeFencedResearchRunMock(...args),
}));

vi.mock("./load", () => ({
  loadResearchForOwner: (...args: unknown[]) => loadResearchForOwnerMock(...args),
}));

import { createSerializedResearchRecovery } from "./claim";
import { createFencedResearchStore } from "./fence";
import { buildRequestPlan } from "./ledger";
import { FixtureResearchProvider } from "./provider/fixture";
import { recoverResearchForOwner } from "./recover";
import { researchRequestKey } from "./request-key";
import type { ResearchIdeaRecord, ResearchRunRecord } from "./types";

const fixtureEnv = { RESEARCH_PROVIDER_MODE: "fixture" };

function interruptedRun(overrides: Partial<ResearchRunRecord> = {}): ResearchRunRecord {
  const ledger = buildRequestPlan({
    offerings: ["silk paint", "gutta resist"],
    languages: ["en"],
    locationCode: 2840,
    requestedAt: "2026-10-11T00:00:00.000Z",
  });
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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
    status: "interrupted",
    requestFingerprint: "f".repeat(64),
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

describe("recoverResearchForOwner", () => {
  const ownedRuns: ResearchRunRecord[] = [];
  const ownedIdeas: ResearchIdeaRecord[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    ownedRuns.length = 0;
    ownedIdeas.length = 0;
    const fence = createFencedResearchStore({ runs: ownedRuns, ideas: ownedIdeas });
    requireObserveOwnerMock.mockResolvedValue({
      website: { id: "site-1", hostname: "example.com" },
      owner: { id: "owner-1", googleIdentityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    });
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([{ id: "sync-new", queriesTruncated: false }]);
    findSearchSyncByIdMock.mockImplementation(async (id: string) => ({ id }));
    listEvidenceForSyncMock.mockResolvedValue([]);
    persistResearchRequestPlanMock.mockImplementation((input) => fence.persistPlan(input));
    claimResearchRequestMock.mockImplementation((input) => fence.claimRequest(input));
    persistResearchRequestResultMock.mockImplementation((input) => fence.persistResult(input));
    skipUnattemptedResearchRequestsMock.mockImplementation((input) => fence.skipUnattempted(input));
    finalizeFencedResearchRunMock.mockImplementation((input) => fence.finalize(input));
    loadResearchForOwnerMock.mockResolvedValue({ readiness: { gate: null }, run: { id: "run-1" } });
  });

  function bindClaimed(run: ResearchRunRecord) {
    ownedRuns.push(run);
    findResearchRunForWebsiteMock.mockResolvedValue(run);
    claimResearchRecoveryMock.mockImplementation(async () => {
      run.status = "running";
      run.executionGeneration += 1;
      return { kind: "claimed_recovery", run };
    });
  }

  it("resolves provider availability before rotating recovery ownership", async () => {
    const existing = interruptedRun({
      provider: "dataforseo",
      providerEnvironment: "live",
    });
    findResearchRunForWebsiteMock.mockResolvedValue(existing);
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");

    await expect(
      recoverResearchForOwner({
        websiteId: "site-1",
        runId: existing.id,
        sessionToken: "session",
        provider,
        env: {
          RESEARCH_PROVIDER_MODE: "live",
          RESEARCH_LIVE_ENABLED: "false",
          DATAFORSEO_LOGIN: "login",
          DATAFORSEO_PASSWORD: "password",
        },
      }),
    ).rejects.toThrow(/not available/i);
    expect(claimResearchRecoveryMock).not.toHaveBeenCalled();
    expect(related).not.toHaveBeenCalled();
  });

  it("resumes the existing run instead of creating a fresh same-fingerprint run", async () => {
    const existing = interruptedRun();
    bindClaimed(existing);
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");

    await recoverResearchForOwner({
      websiteId: "site-1",
      runId: existing.id,
      sessionToken: "session",
      provider,
      env: fixtureEnv,
    });

    expect(claimResearchRecoveryMock).toHaveBeenCalledWith({
      runId: existing.id,
      websiteId: "site-1",
    });
    expect(related).toHaveBeenCalled();
    expect(loadResearchForOwnerMock).toHaveBeenCalled();
  });

  it("does not send the provider or claim recovery when no pairs are safe to resume", async () => {
    const ledger = interruptedRun().requestLedger.map((entry) => ({
      ...entry,
      status: "in_flight" as const,
      attemptedAt: "2026-10-11T00:00:01.000Z",
    }));
    const existing = interruptedRun({ requestLedger: ledger });
    findResearchRunForWebsiteMock.mockResolvedValue(existing);
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");

    await expect(
      recoverResearchForOwner({
        websiteId: "site-1",
        runId: existing.id,
        sessionToken: "session",
        provider,
        env: fixtureEnv,
      }),
    ).rejects.toThrow(/cannot safely run it again/i);
    expect(claimResearchRecoveryMock).not.toHaveBeenCalled();
    expect(related).not.toHaveBeenCalled();
  });

  it("seeds a zero-attempt empty ledger onto the same run", async () => {
    const existing = interruptedRun({
      requestLedger: [],
      offeringSeeds: ["silk paint"],
      languageCodes: ["en"],
    });
    bindClaimed(existing);
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");

    await recoverResearchForOwner({
      websiteId: "site-1",
      runId: existing.id,
      sessionToken: "session",
      provider,
      env: fixtureEnv,
    });

    expect(related).toHaveBeenCalledTimes(1);
    expect(related.mock.calls[0]?.[0]).toMatchObject({ offering: "silk paint", languageCode: "en" });
    expect(existing.requestLedger).toHaveLength(1);
    expect(existing.requestLedger[0]?.requestKey).toBe(researchRequestKey("silk paint", "en"));
  });

  it("does not invoke recovery while a serialized executor already owns the run", async () => {
    const runs: ResearchRunRecord[] = [
      interruptedRun({ id: "run-lock", status: "running", lastProgressAt: new Date().toISOString() }),
    ];
    const serialized = createSerializedResearchRecovery({ runs, now: new Date() });
    claimResearchRecoveryMock.mockImplementation(async (input: { runId: string; websiteId: string }) =>
      serialized.recover(input),
    );
    findResearchRunForWebsiteMock.mockResolvedValue(runs[0]);
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");

    await expect(
      recoverResearchForOwner({
        websiteId: "site-1",
        runId: "run-lock",
        sessionToken: "session",
        provider,
        env: fixtureEnv,
      }),
    ).rejects.toThrow(/already continuing/i);
    expect(related).not.toHaveBeenCalled();
  });

  it("recovers a no-GSC run as gsc_unavailable even after a newer sync exists", async () => {
    const existing = interruptedRun({ gscSyncId: null });
    bindClaimed(existing);
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      { id: "sync-new", queriesTruncated: false },
    ]);
    const provider = new FixtureResearchProvider();

    await recoverResearchForOwner({
      websiteId: "site-1",
      runId: existing.id,
      sessionToken: "session",
      provider,
      env: fixtureEnv,
    });

    expect(findSearchSyncByIdMock).not.toHaveBeenCalled();
    expect(listEvidenceForSyncMock).not.toHaveBeenCalled();
    expect(existing.gscSyncId).toBeNull();
    expect(ownedIdeas.length).toBeGreaterThan(0);
    expect(ownedIdeas.every((idea) => idea.initialGscSampleStatus === "gsc_unavailable")).toBe(true);
  });

  it("classifies recovery against the original run sync, not the latest website sync", async () => {
    const existing = interruptedRun({ gscSyncId: "sync-original" });
    bindClaimed(existing);
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      { id: "sync-new", queriesTruncated: false },
    ]);
    findSearchSyncByIdMock.mockResolvedValue({ id: "sync-original" });
    listEvidenceForSyncMock.mockImplementation(async (syncId: string) =>
      syncId === "sync-original"
        ? [{ evidenceType: "query", queryText: "fixture related term one" }]
        : [{ evidenceType: "query", queryText: "unrelated later query" }],
    );
    const provider = new FixtureResearchProvider();

    await recoverResearchForOwner({
      websiteId: "site-1",
      runId: existing.id,
      sessionToken: "session",
      provider,
      env: fixtureEnv,
    });

    expect(findSearchSyncByIdMock).toHaveBeenCalledWith("sync-original");
    expect(listEvidenceForSyncMock).toHaveBeenCalledWith("sync-original");
    expect(listEvidenceForSyncMock).not.toHaveBeenCalledWith("sync-new");
    expect(
      ownedIdeas.some((idea) => idea.initialGscSampleStatus === "in_current_gsc_sample"),
    ).toBe(true);
  });

  it("fails safely when the original GSC sync cannot be loaded", async () => {
    const existing = interruptedRun({ gscSyncId: "sync-missing" });
    findResearchRunForWebsiteMock.mockResolvedValue(existing);
    findSearchSyncByIdMock.mockResolvedValue(null);
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");

    await expect(
      recoverResearchForOwner({
        websiteId: "site-1",
        runId: existing.id,
        sessionToken: "session",
        provider,
        env: fixtureEnv,
      }),
    ).rejects.toMatchObject({ code: "not_recoverable" });
    expect(claimResearchRecoveryMock).not.toHaveBeenCalled();
    expect(related).not.toHaveBeenCalled();
  });

  it("denies live no-GSC recovery before claim and provider calls", async () => {
    const websiteId = "11111111-1111-4111-8111-111111111111";
    const googleIdentityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const existing = interruptedRun({
      websiteId,
      gscSyncId: null,
      provider: "dataforseo",
      providerEnvironment: "live",
    });
    findResearchRunForWebsiteMock.mockResolvedValue(existing);
    requireObserveOwnerMock.mockResolvedValue({
      website: { id: websiteId, hostname: "example.com" },
      owner: { id: "owner-1", googleIdentityId },
    });
    const provider = {
      id: "dataforseo" as const,
      environment: "live" as const,
      listCountries: vi.fn(async () => [{ key: "US", name: "United States", locationCode: 2840 }]),
      listLanguages: vi.fn(async () => [{ code: "en", name: "English" }]),
      relatedKeywordIdeas: vi.fn(async () => {
        throw new Error("live keywords must not run");
      }),
    };

    await expect(
      recoverResearchForOwner({
        websiteId,
        runId: existing.id,
        sessionToken: "session",
        provider,
        env: {
          RESEARCH_PROVIDER_MODE: "live",
          RESEARCH_LIVE_ENABLED: "true",
          DATAFORSEO_LOGIN: "login",
          DATAFORSEO_PASSWORD: "password",
        },
      }),
    ).rejects.toMatchObject({ code: "no_gsc_live_not_authorized" });
    expect(claimResearchRecoveryMock).not.toHaveBeenCalled();
    expect(provider.relatedKeywordIdeas).not.toHaveBeenCalled();
    expect(provider.listCountries).not.toHaveBeenCalled();
  });

  const websiteId = "11111111-1111-4111-8111-111111111111";
  const googleIdentityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const liveEnv = {
    RESEARCH_PROVIDER_MODE: "live",
    RESEARCH_LIVE_ENABLED: "true",
    DATAFORSEO_LOGIN: "login",
    DATAFORSEO_PASSWORD: "password",
  };

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

  function liveSpyProvider() {
    return {
      id: "dataforseo" as const,
      environment: "live" as const,
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

  it("denies live no-GSC recovery of skipped unattempted work after the allowlist is removed", async () => {
    const existing = rateLimitedThenSkipped(
      interruptedRun({
        websiteId,
        gscSyncId: null,
        provider: "dataforseo",
        providerEnvironment: "live",
      }),
    );
    findResearchRunForWebsiteMock.mockResolvedValue(existing);
    requireObserveOwnerMock.mockResolvedValue({
      website: { id: websiteId, hostname: "example.com" },
      owner: { id: "owner-1", googleIdentityId },
    });
    const provider = liveSpyProvider();

    await expect(
      recoverResearchForOwner({
        websiteId,
        runId: existing.id,
        sessionToken: "session",
        provider,
        env: liveEnv,
      }),
    ).rejects.toMatchObject({ code: "no_gsc_live_not_authorized" });
    expect(claimResearchRecoveryMock).not.toHaveBeenCalled();
    expect(provider.relatedKeywordIdeas).not.toHaveBeenCalled();
    expect(provider.listCountries).not.toHaveBeenCalled();
    expect(ownedIdeas).toHaveLength(0);
    expect(existing.gscSyncId).toBeNull();
    expect(existing.requestLedger[0]?.status).toBe("rate_limited");
    expect(existing.requestLedger[1]?.status).toBe("skipped");
  });

  it("resumes only skipped unattempted live no-GSC work when the pair remains allowlisted", async () => {
    const existing = rateLimitedThenSkipped(
      interruptedRun({
        websiteId,
        gscSyncId: null,
        provider: "dataforseo",
        providerEnvironment: "live",
      }),
    );
    bindClaimed(existing);
    requireObserveOwnerMock.mockResolvedValue({
      website: { id: websiteId, hostname: "example.com" },
      owner: { id: "owner-1", googleIdentityId },
    });
    const provider = liveSpyProvider();

    await recoverResearchForOwner({
      websiteId,
      runId: existing.id,
      sessionToken: "session",
      provider,
      env: {
        ...liveEnv,
        RESEARCH_NO_GSC_LIVE_ALLOWLIST: `${websiteId}:${googleIdentityId}`,
      },
    });

    expect(provider.relatedKeywordIdeas).toHaveBeenCalledTimes(1);
    expect(provider.relatedKeywordIdeas.mock.calls[0]?.[0]).toMatchObject({
      offering: "gutta resist",
    });
    expect(existing.gscSyncId).toBeNull();
    expect(existing.requestLedger[0]?.status).toBe("rate_limited");
    expect(ownedIdeas.length).toBeGreaterThan(0);
    expect(ownedIdeas.every((idea) => idea.initialGscSampleStatus === "gsc_unavailable")).toBe(
      true,
    );
  });

  it("does not require the no-GSC allowlist to recover a GSC-backed live run", async () => {
    const existing = rateLimitedThenSkipped(
      interruptedRun({
        websiteId,
        gscSyncId: "sync-1",
        provider: "dataforseo",
        providerEnvironment: "live",
      }),
    );
    bindClaimed(existing);
    requireObserveOwnerMock.mockResolvedValue({
      website: { id: websiteId, hostname: "example.com" },
      owner: { id: "owner-1", googleIdentityId },
    });
    const provider = liveSpyProvider();

    await recoverResearchForOwner({
      websiteId,
      runId: existing.id,
      sessionToken: "session",
      provider,
      env: liveEnv,
    });

    expect(findSearchSyncByIdMock).toHaveBeenCalledWith("sync-1");
    expect(provider.relatedKeywordIdeas).toHaveBeenCalledTimes(1);
  });

  it("fails closed on skipped live no-GSC recovery when the allowlist is malformed", async () => {
    const existing = rateLimitedThenSkipped(
      interruptedRun({
        websiteId,
        gscSyncId: null,
        provider: "dataforseo",
        providerEnvironment: "live",
      }),
    );
    findResearchRunForWebsiteMock.mockResolvedValue(existing);
    requireObserveOwnerMock.mockResolvedValue({
      website: { id: websiteId, hostname: "example.com" },
      owner: { id: "owner-1", googleIdentityId },
    });
    const provider = liveSpyProvider();

    await expect(
      recoverResearchForOwner({
        websiteId,
        runId: existing.id,
        sessionToken: "session",
        provider,
        env: {
          ...liveEnv,
          RESEARCH_NO_GSC_LIVE_ALLOWLIST: `${websiteId}:${googleIdentityId},not-a-uuid:${googleIdentityId}`,
        },
      }),
    ).rejects.toMatchObject({ code: "no_gsc_live_not_authorized" });
    expect(claimResearchRecoveryMock).not.toHaveBeenCalled();
    expect(provider.relatedKeywordIdeas).not.toHaveBeenCalled();
  });
});
