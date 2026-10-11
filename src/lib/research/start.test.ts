import { beforeEach, describe, expect, it, vi } from "vitest";

const requireObserveOwnerMock = vi.fn();
const findLatestConfirmedSiteModelForWebsiteMock = vi.fn();
const listCompletedSearchSyncsForWebsiteMock = vi.fn();
const listEvidenceForSyncMock = vi.fn();
const claimResearchRunMock = vi.fn();
const updateResearchRunMock = vi.fn();
const insertResearchIdeasMock = vi.fn();
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
  updateResearchRun: (...args: unknown[]) => updateResearchRunMock(...args),
  insertResearchIdeas: (...args: unknown[]) => insertResearchIdeasMock(...args),
  listResearchRunsForFingerprint: (...args: unknown[]) =>
    listResearchRunsForFingerprintMock(...args),
}));

vi.mock("./load", () => ({
  loadResearchForOwner: (...args: unknown[]) => loadResearchForOwnerMock(...args),
}));

import { createSerializedResearchClaim } from "./claim";
import { FixtureResearchProvider } from "./provider/fixture";
import { startResearchForOwner } from "./start";
import type { ResearchRunRecord } from "./types";

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

function claimedRun(id = "run-1"): { kind: "claimed"; run: { id: string } } {
  return { kind: "claimed", run: { id } };
}

describe("startResearchForOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireObserveOwnerMock.mockResolvedValue({
      website: { id: "site-1", hostname: "example.com" },
      owner: { id: "owner-1" },
    });
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue(confirmedModel);
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      { id: "sync-1", queriesTruncated: true },
    ]);
    listEvidenceForSyncMock.mockResolvedValue([
      { evidenceType: "query", queryText: "cianotipo" },
    ]);
    listResearchRunsForFingerprintMock.mockResolvedValue([]);
    claimResearchRunMock.mockResolvedValue(claimedRun());
    updateResearchRunMock.mockResolvedValue({ id: "run-1" });
    insertResearchIdeasMock.mockResolvedValue([]);
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
    const ideas = insertResearchIdeasMock.mock.calls.flatMap(
      (call) => call[0] as Array<{ keyword: string; initialGscSampleStatus: string }>,
    );
    expect(ideas.some((idea) => idea.keyword === "silk paint")).toBe(false);
    expect(ideas.every((idea) => idea.initialGscSampleStatus === "not_in_current_gsc_sample")).toBe(
      true,
    );
    const update = updateResearchRunMock.mock.calls.at(-1)?.[0] as {
      status: string;
      requestLedger: Array<{ status: string }>;
    };
    expect(update.status).toBe("completed");
    expect(update.requestLedger).toHaveLength(2);
  });

  it("persists in_flight before the provider network request", async () => {
    const order: string[] = [];
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas").mockImplementation(async (input) => {
      order.push("network");
      return new FixtureResearchProvider().relatedKeywordIdeas(input);
    });
    updateResearchRunMock.mockImplementation(async (input: { requestLedger?: Array<{ status: string }> }) => {
      const last = input.requestLedger?.at(-1);
      if (last?.status === "in_flight") {
        order.push("in_flight");
      }
      return { id: "run-1" };
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
    updateResearchRunMock.mockImplementation(async (input: { requestLedger?: Array<{ status: string }> }) => {
      const last = input.requestLedger?.at(-1);
      if (last?.status === "in_flight") {
        throw new Error("database unavailable");
      }
      return { id: "run-1" };
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
    let succeededPersisted = false;
    updateResearchRunMock.mockImplementation(async (input: { requestLedger?: Array<{ status: string }> }) => {
      if (input.requestLedger?.some((entry) => entry.status === "succeeded")) {
        succeededPersisted = true;
      }
      if (succeededPersisted && input.requestLedger?.some((entry) => entry.status === "timeout")) {
        throw new Error("crash after first success");
      }
      return { id: "run-1" };
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
    expect(insertResearchIdeasMock).toHaveBeenCalled();
    expect(succeededPersisted).toBe(true);
  });

  it("does not retry after the provider accepts a request but ideas are not persisted", async () => {
    const provider = new FixtureResearchProvider();
    const related = vi.spyOn(provider, "relatedKeywordIdeas");
    insertResearchIdeasMock.mockRejectedValue(new Error("crash before idea persistence"));

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
    const inFlight = updateResearchRunMock.mock.calls.some((call) => {
      const ledger = (call[0] as { requestLedger?: Array<{ status: string; providerTaskId: string | null }> })
        .requestLedger;
      return ledger?.some((entry) => entry.status === "in_flight" && entry.providerTaskId);
    });
    expect(inFlight).toBe(true);
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

  it("blocks retry of a recent failed or partial run", async () => {
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

    await expect(
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "ES",
        languages: ["en"],
        provider,
      }),
    ).rejects.toThrow(/cannot safely run it again/i);
    expect(related).not.toHaveBeenCalled();
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
    const update = updateResearchRunMock.mock.calls.at(-1)?.[0] as {
      status: string;
      requestLedger: Array<{ status: string; ideaCount: number; providerTaskId: string | null }>;
    };
    expect(update.requestLedger.map((entry) => entry.status)).toEqual(["zero_results", "timeout"]);
    expect(update.requestLedger[0]?.providerTaskId).toBe("fixture-task-empty");
    expect(update.status).toBe("partial");
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
    const update = updateResearchRunMock.mock.calls.at(-1)?.[0] as {
      status: string;
      requestLedger: Array<{ status: string }>;
    };
    expect(update.requestLedger.map((entry) => entry.status)).toEqual(["rate_limited", "skipped"]);
    expect(update.status).toBe("failed");
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
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([]);

    await expect(
      startResearchForOwner({
        websiteId: "site-1",
        sessionToken: "session",
        countryKey: "ES",
        languages: ["en"],
        provider,
      }),
    ).rejects.toThrow(/Sync Google Search data/i);
    expect(listCountries).not.toHaveBeenCalled();
    expect(listLanguages).not.toHaveBeenCalled();
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
    updateResearchRunMock.mockImplementation(async (input: {
      id: string;
      status: ResearchRunRecord["status"];
      requestLedger?: ResearchRunRecord["requestLedger"];
      completedAt?: string | null;
    }) => {
      const current = runs.find((run) => run.id === input.id);
      if (current) {
        current.status = input.status;
        if (input.requestLedger) {
          current.requestLedger = input.requestLedger;
        }
        if (input.completedAt !== undefined) {
          current.completedAt = input.completedAt;
        }
      }
      return current ?? { id: input.id };
    });

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
    updateResearchRunMock.mockImplementation(async (input: {
      id: string;
      status: ResearchRunRecord["status"];
      requestLedger?: ResearchRunRecord["requestLedger"];
      completedAt?: string | null;
    }) => {
      const current = runs.find((run) => run.id === input.id);
      if (current) {
        current.status = input.status;
        if (input.requestLedger) {
          current.requestLedger = input.requestLedger;
        }
        if (input.completedAt !== undefined) {
          current.completedAt = input.completedAt;
        }
      }
      return current ?? { id: input.id };
    });

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
    updateResearchRunMock.mockImplementation(async (input: { id: string; status: ResearchRunRecord["status"] }) => {
      const current = runs.find((run) => run.id === input.id);
      if (current) {
        current.status = input.status;
      }
      return current ?? { id: input.id };
    });

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
});
