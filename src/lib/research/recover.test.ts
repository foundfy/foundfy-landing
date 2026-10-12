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

vi.mock("@/lib/gsc/observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwnerMock(...args),
}));

vi.mock("@/lib/gsc/db-search", () => ({
  listCompletedSearchSyncsForWebsite: (...args: unknown[]) =>
    listCompletedSearchSyncsForWebsiteMock(...args),
  listEvidenceForSync: (...args: unknown[]) => listEvidenceForSyncMock(...args),
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
      owner: { id: "owner-1" },
    });
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([{ id: "sync-1", queriesTruncated: false }]);
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
});
