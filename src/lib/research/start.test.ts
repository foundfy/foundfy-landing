import { beforeEach, describe, expect, it, vi } from "vitest";

const requireObserveOwnerMock = vi.fn();
const findLatestConfirmedSiteModelForWebsiteMock = vi.fn();
const listCompletedSearchSyncsForWebsiteMock = vi.fn();
const listEvidenceForSyncMock = vi.fn();
const claimResearchRunMock = vi.fn();
const persistResearchRequestPlanMock = vi.fn();
const claimResearchRequestMock = vi.fn();
const persistResearchRequestResultMock = vi.fn();
const skipUnattemptedResearchRequestsMock = vi.fn();
const finalizeFencedResearchRunMock = vi.fn();
const listResearchRunsForFingerprintMock = vi.fn();
const loadResearchForOwnerMock = vi.fn();

vi.mock("@/lib/gsc/observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwnerMock(...args),
}));

vi.mock("@/lib/site-model/repository", () => ({
  findLatestConfirmedSiteModelForWebsite: (...args: unknown[]) =>
    findLatestConfirmedSiteModelForWebsiteMock(...args),
}));

vi.mock("@/lib/gsc/db-search", () => ({
  listCompletedSearchSyncsForWebsite: (...args: unknown[]) =>
    listCompletedSearchSyncsForWebsiteMock(...args),
  listEvidenceForSync: (...args: unknown[]) => listEvidenceForSyncMock(...args),
}));

vi.mock("./repository", () => ({
  claimResearchRun: (...args: unknown[]) => claimResearchRunMock(...args),
  persistResearchRequestPlan: (...args: unknown[]) => persistResearchRequestPlanMock(...args),
  claimResearchRequest: (...args: unknown[]) => claimResearchRequestMock(...args),
  persistResearchRequestResult: (...args: unknown[]) => persistResearchRequestResultMock(...args),
  skipUnattemptedResearchRequests: (...args: unknown[]) =>
    skipUnattemptedResearchRequestsMock(...args),
  finalizeFencedResearchRun: (...args: unknown[]) => finalizeFencedResearchRunMock(...args),
  listResearchRunsForFingerprint: (...args: unknown[]) =>
    listResearchRunsForFingerprintMock(...args),
}));

vi.mock("./load", () => ({
  loadResearchForOwner: (...args: unknown[]) => loadResearchForOwnerMock(...args),
}));

import { createSerializedResearchClaim } from "./claim";
import { ResearchGateError, ResearchProviderError } from "./errors";
import { createFencedResearchStore, type FencedResearchStore } from "./fence";
import { researchRequestFingerprint } from "./fingerprint";
import { DataForSeoLiveResearchProvider } from "./provider/dataforseo-live";
import { FixtureResearchProvider } from "./provider/fixture";
import { startResearchForOwner } from "./start";
import type { ResearchProvider } from "./provider/types";
import type { ResearchIdeaRecord, ResearchRunRecord } from "./types";

const confirmedModel = {
  id: "model-1",
  status: "stale",
  understanding: {
    hostname: "example.com",
    languages: { htmlLangs: ["en", "es"] },
  },
  confirmed: {
    confirmedAt: "2026-10-01T00:00:00.000Z",
    offers: ["silk paint", "gutta resist"],
  },
};

function claimedRunFromInput(input: {
  websiteId: string;
  offeringSeeds: string[];
  languageCodes: string[];
  locationCode: number;
  countryKey: string;
  countryName: string;
  siteModelId: string;
  siteModelConfirmedAt: string;
  requestedBy: string;
  gscSyncId: string | null;
  gscQueriesTruncated: boolean;
  provider: "fixture" | "dataforseo";
  providerEnvironment: "fixture" | "sandbox" | "live";
  requestFingerprint: string;
}): { kind: "claimed"; run: ResearchRunRecord } {
  const timestamp = new Date().toISOString();
  return {
    kind: "claimed",
    run: {
      id: "run-1",
      websiteId: input.websiteId,
      siteModelId: input.siteModelId,
      siteModelConfirmedAt: input.siteModelConfirmedAt,
      requestedBy: input.requestedBy,
      gscSyncId: input.gscSyncId,
      gscQueriesTruncated: input.gscQueriesTruncated,
      countryKey: input.countryKey,
      countryName: input.countryName,
      locationCode: input.locationCode,
      languageCodes: input.languageCodes,
      offeringSeeds: input.offeringSeeds,
      provider: input.provider,
      providerEnvironment: input.providerEnvironment,
      status: "requested",
      requestFingerprint: input.requestFingerprint,
      requestLedger: [],
      providerCost: null,
      failureCode: null,
      failureMessage: null,
      createdAt: timestamp,
      startedAt: null,
      completedAt: null,
      updatedAt: timestamp,
      lastProgressAt: timestamp,
      executionGeneration: 1,
      closedAt: null,
    },
  };
}

const ownedRuns: ResearchRunRecord[] = [];
const ownedIdeas: ResearchIdeaRecord[] = [];
let fence: FencedResearchStore;

function bindFenceStore() {
  persistResearchRequestPlanMock.mockImplementation((input) => fence.persistPlan(input));
  claimResearchRequestMock.mockImplementation((input) => fence.claimRequest(input));
  persistResearchRequestResultMock.mockImplementation((input) => fence.persistResult(input));
  skipUnattemptedResearchRequestsMock.mockImplementation((input) => fence.skipUnattempted(input));
  finalizeFencedResearchRunMock.mockImplementation((input) => fence.finalize(input));
}

describe("startResearchForOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ownedRuns.length = 0;
    ownedIdeas.length = 0;
    fence = createFencedResearchStore({ runs: ownedRuns, ideas: ownedIdeas });
    requireObserveOwnerMock.mockResolvedValue({
      website: { id: "site-1", hostname: "example.com" },
      owner: { id: "owner-1", googleIdentityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    });
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue(confirmedModel);
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      { id: "sync-1", queriesTruncated: true },
    ]);
    listEvidenceForSyncMock.mockResolvedValue([
      { evidenceType: "query", queryText: "cianotipo" },
    ]);
    listResearchRunsForFingerprintMock.mockResolvedValue([]);
    claimResearchRunMock.mockImplementation(async (input: Parameters<typeof claimedRunFromInput>[0]) => {
      const result = claimedRunFromInput(input);
      ownedRuns.push(result.run);
      return result;
    });
    bindFenceStore();
    loadResearchForOwnerMock.mockResolvedValue({ readiness: { gate: null }, run: { id: "run-1" } });
  });

  it("persists ideas, retrieval-time GSC status, and request provenance", async () => {
    const provider = new FixtureResearchProvider();
    await startResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      countryKey: "ES",
      languages: ["en"],
      provider,
    });

    expect(claimResearchRunMock).toHaveBeenCalled();
    expect(ownedIdeas.some((idea) => idea.keyword === "silk paint")).toBe(false);
    expect(
      ownedIdeas.every((idea) => idea.initialGscSampleStatus === "not_in_current_gsc_sample"),
    ).toBe(true);
    expect(ownedRuns[0]?.status).toBe("completed");
    expect(ownedRuns[0]?.requestLedger).toHaveLength(2);
  });

  it("persists the full pending request plan before the first provider network request", async () => {
    const order: string[] = [];
    const provider = new FixtureResearchProvider();
    vi.spyOn(provider, "relatedKeywordIdeas").mockImplementation(async (input) => {
      order.push("network");
      return new FixtureResearchProvider().relatedKeywordIdeas(input);
    });
    persistResearchRequestPlanMock.mockImplementation((input) => {
      order.push("plan");
      return fence.persistPlan(input);
    });

    await startResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      countryKey: "US",
      languages: ["en"],
      selectedOfferings: ["silk paint"],
      provider,
    });

    expect(order[0]).toBe("plan");
    expect(order.indexOf("plan")).toBeLessThan(order.indexOf("network"));
  });

  it("does not call the provider if the request plan cannot be persisted", async () => {
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");
    persistResearchRequestPlanMock.mockImplementation(() => {
      throw new Error("plan persist failed");
    });

    await expect(
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "US",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider,
      }),
    ).rejects.toThrow(/plan persist failed/);
    expect(related).not.toHaveBeenCalled();
  });

  it("persists in_flight before the provider network request", async () => {
    const order: string[] = [];
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas").mockImplementation(async (input) => {
      order.push("network");
      return new FixtureResearchProvider().relatedKeywordIdeas(input);
    });
    claimResearchRequestMock.mockImplementation((input) => {
      const result = fence.claimRequest(input);
      if (result.outcome === "claimed") {
        order.push("in_flight");
      }
      return result;
    });

    await startResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      countryKey: "US",
      languages: ["en"],
      selectedOfferings: ["silk paint"],
      provider,
    });

    expect(order[0]).toBe("in_flight");
    expect(order.indexOf("in_flight")).toBeLessThan(order.indexOf("network"));
    expect(related).toHaveBeenCalled();
  });

  it("does not call the provider if the durable in_flight write fails", async () => {
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");
    claimResearchRequestMock.mockImplementation(() => {
      throw new Error("database unavailable");
    });

    await expect(
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "US",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider,
      }),
    ).rejects.toThrow(/database unavailable/);
    expect(related).not.toHaveBeenCalled();
  });

  it("keeps the first successful request after a later interruption", async () => {
    const provider = new FixtureResearchProvider();
    provider.setBehavior("gutta resist", "en", "timeout");
    persistResearchRequestResultMock.mockImplementation((input) => {
      if (input.status === "timeout") {
        throw new Error("crash after first success");
      }
      return fence.persistResult(input);
    });

    await expect(
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "US",
        languages: ["en"],
        provider,
      }),
    ).rejects.toThrow(/crash after first success/);
    expect(ownedIdeas.length).toBeGreaterThan(0);
    expect(ownedRuns[0]?.requestLedger.some((entry) => entry.status === "succeeded")).toBe(true);
  });

  it("does not retry after the provider accepts a request but ideas are not persisted", async () => {
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");
    persistResearchRequestResultMock.mockImplementation(() => {
      throw new Error("crash before idea persistence");
    });

    await expect(
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "US",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider,
      }),
    ).rejects.toThrow(/crash before idea persistence/);
    expect(related).toHaveBeenCalledTimes(1);
    expect(ownedRuns[0]?.requestLedger.some((entry) => entry.status === "in_flight" && entry.attemptedAt)).toBe(
      true,
    );
    expect(ownedIdeas).toHaveLength(0);
  });

  it("does not automatically retry an ambiguous in-flight run", async () => {
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");
    listResearchRunsForFingerprintMock.mockResolvedValue([
      {
        id: "run-active",
        status: "running",
        requestFingerprint: "ignored",
        createdAt: new Date().toISOString(),
        requestLedger: [{ status: "in_flight", seedOffering: "silk paint", languageCode: "en" }],
      },
    ]);
    const listCountries = vi.spyOn(provider, "listCountries");

    await startResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      countryKey: "ES",
      languages: ["en"],
      provider,
    });

    expect(related).not.toHaveBeenCalled();
    expect(listCountries).not.toHaveBeenCalled();
    expect(claimResearchRunMock).not.toHaveBeenCalled();
  });

  it("does not repeat a completed request", async () => {
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");
    const listCountries = vi.spyOn(provider, "listCountries");
    listResearchRunsForFingerprintMock.mockResolvedValue([
      {
        id: "old-run",
        status: "completed",
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        requestLedger: [{ status: "succeeded" }],
      },
    ]);

    await startResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      countryKey: "ES",
      languages: ["en"],
      provider,
    });
    expect(related).not.toHaveBeenCalled();
    expect(listCountries).not.toHaveBeenCalled();
    expect(claimResearchRunMock).not.toHaveBeenCalled();
  });

  it("treats a closed historical run as eligible for a later explicit new cycle, not recovery", async () => {
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");
    listResearchRunsForFingerprintMock.mockResolvedValue([
      {
        id: "closed-run",
        status: "closed",
        createdAt: new Date().toISOString(),
        closedAt: new Date().toISOString(),
        requestLedger: [{ status: "in_flight", attemptedAt: "2026-10-11T00:00:01.000Z" }],
      },
    ]);

    await startResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      countryKey: "ES",
      languages: ["en"],
      provider,
    });

    expect(claimResearchRunMock).toHaveBeenCalled();
    expect(related).toHaveBeenCalled();
    expect(ownedRuns).toHaveLength(1);
    expect(ownedRuns[0]?.id).not.toBe("closed-run");
  });

  it("does not start a fresh run when recovery is required for a failed or partial run", async () => {
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");
    listResearchRunsForFingerprintMock.mockResolvedValue([
      {
        id: "failed-run",
        status: "failed",
        createdAt: new Date().toISOString(),
        requestLedger: [{ status: "rate_limited" }],
      },
    ]);

    await startResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      countryKey: "ES",
      languages: ["en"],
      provider,
    });
    expect(related).not.toHaveBeenCalled();
    expect(claimResearchRunMock).not.toHaveBeenCalled();
    expect(loadResearchForOwnerMock).toHaveBeenCalled();
  });

  it("keeps zero-result and failed request provenance and can settle partial", async () => {
    const provider = new FixtureResearchProvider();
    provider.setBehavior("silk paint", "en", "empty");
    provider.setBehavior("gutta resist", "en", "timeout");
    await startResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      countryKey: "US",
      languages: ["en"],
      provider,
    });
    expect(ownedRuns[0]?.requestLedger.map((entry) => entry.status)).toEqual(["zero_results", "timeout"]);
    expect(ownedRuns[0]?.requestLedger[0]?.providerTaskId).toBe("fixture-task-empty");
    expect(ownedRuns[0]?.status).toBe("partial");
  });

  it("skips remaining requests after a rate limit and does not call AI", async () => {
    const provider = new FixtureResearchProvider();
    provider.setBehavior("silk paint", "en", "rate_limit");
    await startResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      countryKey: "US",
      languages: ["en"],
      selectedOfferings: ["silk paint", "gutta resist"],
      provider,
    });
    expect(ownedRuns[0]?.requestLedger.map((entry) => entry.status)).toEqual(["rate_limited", "skipped"]);
    expect(ownedRuns[0]?.status).toBe("interrupted");
  });

  it("does not fetch provider metadata when a cheap local gate fails", async () => {
    const provider = new FixtureResearchProvider();
    const listCountries = vi.spyOn(provider, "listCountries");
    const listLanguages = vi.spyOn(provider, "listLanguages");
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue(null);

    await expect(
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "ES",
        languages: ["en"],
        provider,
      }),
    ).rejects.toThrow(/Confirm what your business offers/i);
    expect(listCountries).not.toHaveBeenCalled();
    expect(listLanguages).not.toHaveBeenCalled();

    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue(confirmedModel);
  });

  it("lets two same-context starts execute the provider only once", async () => {
    const runs: ResearchRunRecord[] = [];
    const serialized = createSerializedResearchClaim({ runs });
    listResearchRunsForFingerprintMock.mockImplementation(async () => runs.slice());
    claimResearchRunMock.mockImplementation(async (input: {
      websiteId: string;
      requestFingerprint: string;
      countryKey: string;
      countryName: string;
      locationCode: number;
      languageCodes: string[];
      offeringSeeds: string[];
      siteModelId: string;
      siteModelConfirmedAt: string;
      requestedBy: string;
      gscSyncId: string;
      gscQueriesTruncated: boolean;
      provider: "fixture";
      providerEnvironment: "fixture";
    }) =>
      serialized.claim({
        websiteId: input.websiteId,
        requestFingerprint: input.requestFingerprint,
        insert: {
          websiteId: input.websiteId,
          siteModelId: input.siteModelId,
          siteModelConfirmedAt: input.siteModelConfirmedAt,
          requestedBy: input.requestedBy,
          gscSyncId: input.gscSyncId,
          gscQueriesTruncated: input.gscQueriesTruncated,
          countryKey: input.countryKey,
          countryName: input.countryName,
          locationCode: input.locationCode,
          languageCodes: input.languageCodes,
          offeringSeeds: input.offeringSeeds,
          provider: input.provider,
          providerEnvironment: input.providerEnvironment,
          requestFingerprint: input.requestFingerprint,
        },
      }),
    );
    fence = createFencedResearchStore({ runs, ideas: ownedIdeas });
    bindFenceStore();

    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");
    const start = () =>
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "ES",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider,
      });

    await Promise.all([start(), start()]);
    expect(related).toHaveBeenCalledTimes(1);
    expect(runs.filter((run) => run.status === "requested" || run.status === "running")).toHaveLength(
      0,
    );
    expect(runs).toHaveLength(1);
  });

  it("reuses a completed run when the second claim waits until the first finishes", async () => {
    const runs: ResearchRunRecord[] = [];
    let acquisitions = 0;
    let releaseSecond!: () => void;
    const secondMayProceed = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const serialized = createSerializedResearchClaim({
      runs,
      afterAcquire: async () => {
        acquisitions += 1;
        if (acquisitions > 1) {
          await secondMayProceed;
        }
      },
    });
    listResearchRunsForFingerprintMock.mockImplementation(async () => runs.slice());
    claimResearchRunMock.mockImplementation(async (input: {
      websiteId: string;
      requestFingerprint: string;
      countryKey: string;
      countryName: string;
      locationCode: number;
      languageCodes: string[];
      offeringSeeds: string[];
      siteModelId: string;
      siteModelConfirmedAt: string;
      requestedBy: string;
      gscSyncId: string;
      gscQueriesTruncated: boolean;
      provider: "fixture";
      providerEnvironment: "fixture";
    }) =>
      serialized.claim({
        websiteId: input.websiteId,
        requestFingerprint: input.requestFingerprint,
        insert: {
          websiteId: input.websiteId,
          siteModelId: input.siteModelId,
          siteModelConfirmedAt: input.siteModelConfirmedAt,
          requestedBy: input.requestedBy,
          gscSyncId: input.gscSyncId,
          gscQueriesTruncated: input.gscQueriesTruncated,
          countryKey: input.countryKey,
          countryName: input.countryName,
          locationCode: input.locationCode,
          languageCodes: input.languageCodes,
          offeringSeeds: input.offeringSeeds,
          provider: input.provider,
          providerEnvironment: input.providerEnvironment,
          requestFingerprint: input.requestFingerprint,
        },
      }),
    );
    fence = createFencedResearchStore({ runs, ideas: ownedIdeas });
    bindFenceStore();

    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");
    const start = () =>
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "ES",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider,
      });

    const first = start();
    const second = start();
    await vi.waitFor(() => {
      expect(runs.some((run) => run.status === "completed")).toBe(true);
    });
    releaseSecond();
    await Promise.all([first, second]);
    expect(related).toHaveBeenCalledTimes(1);
    expect(runs).toHaveLength(1);
  });

  it("lets different fingerprints execute independently", async () => {
    const runs: ResearchRunRecord[] = [];
    const serialized = createSerializedResearchClaim({ runs });
    listResearchRunsForFingerprintMock.mockImplementation(async (input: { fingerprint: string }) =>
      runs.filter((run) => run.requestFingerprint === input.fingerprint),
    );
    claimResearchRunMock.mockImplementation(async (input: {
      websiteId: string;
      requestFingerprint: string;
      countryKey: string;
      countryName: string;
      locationCode: number;
      languageCodes: string[];
      offeringSeeds: string[];
      siteModelId: string;
      siteModelConfirmedAt: string;
      requestedBy: string;
      gscSyncId: string;
      gscQueriesTruncated: boolean;
      provider: "fixture";
      providerEnvironment: "fixture";
    }) =>
      serialized.claim({
        websiteId: input.websiteId,
        requestFingerprint: input.requestFingerprint,
        insert: {
          websiteId: input.websiteId,
          siteModelId: input.siteModelId,
          siteModelConfirmedAt: input.siteModelConfirmedAt,
          requestedBy: input.requestedBy,
          gscSyncId: input.gscSyncId,
          gscQueriesTruncated: input.gscQueriesTruncated,
          countryKey: input.countryKey,
          countryName: input.countryName,
          locationCode: input.locationCode,
          languageCodes: input.languageCodes,
          offeringSeeds: input.offeringSeeds,
          provider: input.provider,
          providerEnvironment: input.providerEnvironment,
          requestFingerprint: input.requestFingerprint,
        },
      }),
    );
    fence = createFencedResearchStore({ runs, ideas: ownedIdeas });
    bindFenceStore();

    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");
    await Promise.all([
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "ES",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider,
      }),
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "US",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider,
      }),
    ]);
    expect(related.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(runs).toHaveLength(2);
  });

  it("does not execute the provider while the claim lock is held", async () => {
    const runs: ResearchRunRecord[] = [];
    const order: string[] = [];
    const serialized = createSerializedResearchClaim({
      runs,
      afterAcquire: async () => {
        order.push("lock");
      },
    });
    fence = createFencedResearchStore({ runs, ideas: ownedIdeas });
    bindFenceStore();
    claimResearchRunMock.mockImplementation(async (input: Parameters<typeof claimedRunFromInput>[0]) => {
      const result = await serialized.claim({
        websiteId: input.websiteId,
        requestFingerprint: input.requestFingerprint,
        insert: { ...input, requestFingerprint: input.requestFingerprint },
      });
      order.push("claimed");
      return result;
    });
    const provider = new FixtureResearchProvider();
    vi.spyOn(provider, "relatedKeywordIdeas").mockImplementation(async (input) => {
      order.push("network");
      return new FixtureResearchProvider().relatedKeywordIdeas(input);
    });

    await startResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      countryKey: "ES",
      languages: ["en"],
      selectedOfferings: ["silk paint"],
      provider,
    });

    expect(order.indexOf("lock")).toBeLessThan(order.indexOf("claimed"));
    expect(order.indexOf("claimed")).toBeLessThan(order.indexOf("network"));
  });

  it("maps live metadata task failure to a provider error, not invalid_country, and never claims or pays", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/keywords_for_keywords/")) {
        throw new Error("keywords_for_keywords must not run");
      }
      if (url.includes("/languages")) {
        return new Response(
          JSON.stringify({
            status_code: 20000,
            tasks: [
              {
                status_code: 20000,
                result: [{ language_code: "en", language_name: "English" }],
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          status_code: 20000,
          tasks: [{ status_code: 40100, status_message: "Unauthorized.", result: null }],
        }),
        { status: 200 },
      );
    });
    const provider = new DataForSeoLiveResearchProvider({
      login: "login",
      password: "password",
      liveEnabled: true,
      fetchImpl,
    });

    await expect(
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "US",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider,
      }),
    ).rejects.toBeInstanceOf(ResearchProviderError);

    try {
      await startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "US",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ResearchProviderError);
      expect(error).not.toBeInstanceOf(ResearchGateError);
      expect((error as ResearchProviderError).code).toBe("invalid_response");
    }

    expect(claimResearchRunMock).not.toHaveBeenCalled();
    expect(persistResearchRequestPlanMock).not.toHaveBeenCalled();
    expect(claimResearchRequestMock).not.toHaveBeenCalled();
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes("/keywords_for_keywords/"))).toBe(
      false,
    );
    expect(ownedRuns).toHaveLength(0);
    expect(ownedIdeas).toHaveLength(0);
  });

  it("resolves US and en from valid live metadata and continues to the claim path", async () => {
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes("/locations")) {
        expect(init.method).toBe("GET");
        expect(init.body).toBeUndefined();
        return new Response(
          JSON.stringify({
            status_code: 20000,
            tasks: [
              {
                status_code: 20000,
                result: [
                  {
                    location_code: 1014221,
                    location_name: "New York,New York,United States",
                    country_iso_code: "US",
                    location_type: "City",
                  },
                  {
                    location_code: 2840,
                    location_name: "United States",
                    country_iso_code: "US",
                    location_type: "Country",
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/languages")) {
        expect(init.method).toBe("GET");
        expect(init.body).toBeUndefined();
        return new Response(
          JSON.stringify({
            status_code: 20000,
            tasks: [
              {
                status_code: 20000,
                result: [{ language_code: "en", language_name: "English" }],
              },
            ],
          }),
          { status: 200 },
        );
      }
      expect(init.method).toBe("POST");
      expect(init.body).toBeDefined();
      return new Response(
        JSON.stringify({
          tasks: [
            {
              id: "live-task",
              status_code: 20000,
              result: [{ keyword: "seo audit", search_volume: 10 }],
            },
          ],
        }),
        { status: 200 },
      );
    });
    const provider = new DataForSeoLiveResearchProvider({
      login: "login",
      password: "password",
      liveEnabled: true,
      fetchImpl,
    });

    await startResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      countryKey: "US",
      languages: ["en"],
      selectedOfferings: ["silk paint"],
      provider,
    });

    expect(claimResearchRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        countryKey: "US",
        countryName: "United States",
        locationCode: 2840,
        languageCodes: ["en"],
      }),
    );
    expect(persistResearchRequestPlanMock).toHaveBeenCalled();
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes("/keywords_for_keywords/"))).toBe(
      true,
    );
  });

  it("maps live language metadata failure to a provider error, not unsupported_language", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/keywords_for_keywords/")) {
        throw new Error("keywords_for_keywords must not run");
      }
      if (url.includes("/languages")) {
        return new Response(
          JSON.stringify({
            status_code: 20000,
            tasks: [{ status_code: 40100, result: null }],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              result: [
                {
                  location_code: 2840,
                  location_name: "United States",
                  country_iso_code: "US",
                  location_type: "Country",
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    });
    const provider = new DataForSeoLiveResearchProvider({
      login: "login",
      password: "password",
      liveEnabled: true,
      fetchImpl,
    });

    await expect(
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "US",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider,
      }),
    ).rejects.toMatchObject({ name: "ResearchProviderError", code: "invalid_response" });
    expect(claimResearchRunMock).not.toHaveBeenCalled();
  });

  it("keeps HTTP 401 locations metadata as unauthorized, not invalid_country", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 401 }));
    const provider = new DataForSeoLiveResearchProvider({
      login: "login",
      password: "password",
      liveEnabled: true,
      fetchImpl,
    });

    await expect(
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "US",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider,
      }),
    ).rejects.toMatchObject({ name: "ResearchProviderError", code: "unauthorized" });
    expect(claimResearchRunMock).not.toHaveBeenCalled();
  });

  it("keeps invalid_country when valid live Country metadata genuinely lacks US", async () => {
    const provider: ResearchProvider = {
      id: "dataforseo",
      environment: "live",
      listCountries: async () => [{ key: "ES", name: "Spain", locationCode: 2724 }],
      listLanguages: async () => [{ code: "en", name: "English" }],
      relatedKeywordIdeas: async () => {
        throw new Error("keywords_for_keywords must not run");
      },
    };

    await expect(
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "US",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider,
      }),
    ).rejects.toMatchObject({ name: "ResearchGateError", code: "invalid_country" });
    expect(claimResearchRunMock).not.toHaveBeenCalled();
  });

  it("refuses live provider start when RESEARCH_LIVE_ENABLED is false", async () => {
    const fetchImpl = vi.fn();
    await expect(
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "ES",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        env: {
          RESEARCH_PROVIDER_MODE: "live",
          RESEARCH_LIVE_ENABLED: "false",
          DATAFORSEO_LOGIN: "login",
          DATAFORSEO_PASSWORD: "password",
        },
        fetchImpl,
      }),
    ).rejects.toMatchObject({ name: "ResearchGateError", code: "live_not_enabled" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(claimResearchRunMock).not.toHaveBeenCalled();
  });

  const websiteId = "11111111-1111-4111-8111-111111111111";
  const otherWebsiteId = "22222222-2222-4222-8222-222222222222";
  const googleIdentityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const otherIdentityId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  function liveSpyProvider(): ResearchProvider & {
    listCountries: ReturnType<typeof vi.fn>;
    listLanguages: ReturnType<typeof vi.fn>;
    relatedKeywordIdeas: ReturnType<typeof vi.fn>;
  } {
    return {
      id: "dataforseo",
      environment: "live",
      listCountries: vi.fn(async () => [{ key: "ES", name: "Spain", locationCode: 2724 }]),
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

  it("starts fixture research without a completed GSC sync", async () => {
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([]);
    const provider = new FixtureResearchProvider();
    await startResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      countryKey: "ES",
      languages: ["en"],
      selectedOfferings: ["silk paint"],
      provider,
    });
    expect(claimResearchRunMock).toHaveBeenCalledWith(
      expect.objectContaining({ gscSyncId: null, gscQueriesTruncated: false }),
    );
    expect(listEvidenceForSyncMock).not.toHaveBeenCalled();
    expect(ownedIdeas.length).toBeGreaterThan(0);
    expect(ownedIdeas.every((idea) => idea.initialGscSampleStatus === "gsc_unavailable")).toBe(true);
  });

  it("keeps an empty completed GSC sample distinct from missing GSC", async () => {
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      { id: "sync-empty", queriesTruncated: false },
    ]);
    listEvidenceForSyncMock.mockResolvedValue([]);
    await startResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      countryKey: "ES",
      languages: ["en"],
      selectedOfferings: ["silk paint"],
      provider: new FixtureResearchProvider(),
    });
    expect(claimResearchRunMock).toHaveBeenCalledWith(
      expect.objectContaining({ gscSyncId: "sync-empty" }),
    );
    expect(ownedIdeas.length).toBeGreaterThan(0);
    expect(
      ownedIdeas.every((idea) => idea.initialGscSampleStatus === "not_in_current_gsc_sample"),
    ).toBe(true);
  });

  it("reuses a completed no-GSC run after GSC appears without another provider call", async () => {
    const fingerprint = researchRequestFingerprint({
      websiteId: "site-1",
      siteModelId: "model-1",
      confirmedAt: "2026-10-01T00:00:00.000Z",
      offerings: ["silk paint"],
      countryKey: "US",
      languages: ["en"],
      provider: "fixture",
      environment: "fixture",
    });
    listResearchRunsForFingerprintMock.mockResolvedValue([
      {
        id: "run-historical",
        websiteId: "site-1",
        status: "completed",
        completedAt: "2026-10-20T00:00:00.000Z",
        gscSyncId: null,
        requestFingerprint: fingerprint,
        requestLedger: [],
        createdAt: "2026-10-20T00:00:00.000Z",
      },
    ]);
    const provider = new FixtureResearchProvider();
    const listCountries = vi.spyOn(provider, "listCountries");
    const related = vi.spyOn(provider, "relatedKeywordIdeas");
    await startResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      countryKey: "US",
      languages: ["en"],
      selectedOfferings: ["silk paint"],
      provider,
    });
    expect(claimResearchRunMock).not.toHaveBeenCalled();
    expect(listCountries).not.toHaveBeenCalled();
    expect(related).not.toHaveBeenCalled();
    expect(loadResearchForOwnerMock).toHaveBeenCalled();
  });

  it("denies live no-GSC start before claim and provider metadata", async () => {
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([]);
    requireObserveOwnerMock.mockResolvedValue({
      website: { id: websiteId, hostname: "example.com" },
      owner: { id: "owner-1", googleIdentityId },
    });
    const provider = liveSpyProvider();
    await expect(
      startResearchForOwner({
        websiteId,
        sessionToken: "session",
        countryKey: "ES",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider,
        env: {
          RESEARCH_PROVIDER_MODE: "live",
          RESEARCH_LIVE_ENABLED: "true",
          DATAFORSEO_LOGIN: "login",
          DATAFORSEO_PASSWORD: "password",
        },
      }),
    ).rejects.toMatchObject({ code: "no_gsc_live_not_authorized" });
    expect(provider.listCountries).not.toHaveBeenCalled();
    expect(provider.listLanguages).not.toHaveBeenCalled();
    expect(provider.relatedKeywordIdeas).not.toHaveBeenCalled();
    expect(claimResearchRunMock).not.toHaveBeenCalled();
  });

  it("allows live no-GSC start only for the matching website and identity pair", async () => {
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([]);
    requireObserveOwnerMock.mockResolvedValue({
      website: { id: websiteId, hostname: "example.com" },
      owner: { id: "owner-1", googleIdentityId },
    });
    const provider = liveSpyProvider();
    await startResearchForOwner({
      websiteId,
      sessionToken: "session",
      countryKey: "ES",
      languages: ["en"],
      selectedOfferings: ["silk paint"],
      provider,
      env: {
        RESEARCH_PROVIDER_MODE: "live",
        RESEARCH_LIVE_ENABLED: "true",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
        RESEARCH_NO_GSC_LIVE_ALLOWLIST: `${websiteId}:${googleIdentityId}`,
      },
    });
    expect(claimResearchRunMock).toHaveBeenCalledWith(expect.objectContaining({ gscSyncId: null }));
    expect(provider.relatedKeywordIdeas).toHaveBeenCalled();
    expect(ownedIdeas.every((idea) => idea.initialGscSampleStatus === "gsc_unavailable")).toBe(true);

    vi.clearAllMocks();
    ownedRuns.length = 0;
    ownedIdeas.length = 0;
    fence = createFencedResearchStore({ runs: ownedRuns, ideas: ownedIdeas });
    bindFenceStore();
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([]);
    listResearchRunsForFingerprintMock.mockResolvedValue([]);
    claimResearchRunMock.mockImplementation(async (input: Parameters<typeof claimedRunFromInput>[0]) => {
      const result = claimedRunFromInput(input);
      ownedRuns.push(result.run);
      return result;
    });
    requireObserveOwnerMock.mockResolvedValue({
      website: { id: otherWebsiteId, hostname: "example.com" },
      owner: { id: "owner-1", googleIdentityId },
    });
    const otherSiteProvider = liveSpyProvider();
    await expect(
      startResearchForOwner({
        websiteId: otherWebsiteId,
        sessionToken: "session",
        countryKey: "ES",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider: otherSiteProvider,
        env: {
          RESEARCH_PROVIDER_MODE: "live",
          RESEARCH_LIVE_ENABLED: "true",
          DATAFORSEO_LOGIN: "login",
          DATAFORSEO_PASSWORD: "password",
          RESEARCH_NO_GSC_LIVE_ALLOWLIST: `${websiteId}:${googleIdentityId}`,
        },
      }),
    ).rejects.toMatchObject({ code: "no_gsc_live_not_authorized" });
    expect(otherSiteProvider.listCountries).not.toHaveBeenCalled();

    requireObserveOwnerMock.mockResolvedValue({
      website: { id: websiteId, hostname: "example.com" },
      owner: { id: "owner-1", googleIdentityId: otherIdentityId },
    });
    const otherIdentityProvider = liveSpyProvider();
    await expect(
      startResearchForOwner({
        websiteId,
        sessionToken: "session",
        countryKey: "ES",
        languages: ["en"],
        selectedOfferings: ["silk paint"],
        provider: otherIdentityProvider,
        env: {
          RESEARCH_PROVIDER_MODE: "live",
          RESEARCH_LIVE_ENABLED: "true",
          DATAFORSEO_LOGIN: "login",
          DATAFORSEO_PASSWORD: "password",
          RESEARCH_NO_GSC_LIVE_ALLOWLIST: `${websiteId}:${googleIdentityId}`,
        },
      }),
    ).rejects.toMatchObject({ code: "no_gsc_live_not_authorized" });
    expect(otherIdentityProvider.relatedKeywordIdeas).not.toHaveBeenCalled();
  });
});
