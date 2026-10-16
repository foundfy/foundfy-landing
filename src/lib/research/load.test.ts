import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireObserveOwnerMock = vi.fn();
const findLatestConfirmedSiteModelForWebsiteMock = vi.fn();
const listCompletedSearchSyncsForWebsiteMock = vi.fn();
const listEvidenceForSyncMock = vi.fn();
const findLatestCompatibleResearchRunMock = vi.fn();
const listResearchIdeasForRunMock = vi.fn();

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
  findLatestCompatibleResearchRun: (...args: unknown[]) =>
    findLatestCompatibleResearchRunMock(...args),
  listResearchIdeasForRun: (...args: unknown[]) => listResearchIdeasForRunMock(...args),
}));

const listInspectionsForResearchIdeasMock = vi.fn();

vi.mock("@/lib/decisions/inspect", () => ({
  listInspectionsForResearchIdeas: (...args: unknown[]) =>
    listInspectionsForResearchIdeasMock(...args),
}));

import { loadResearchForOwner } from "./load";
import { researchRequestKey } from "./request-key";

const originalEnv = { ...process.env };

describe("loadResearchForOwner", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEARCH_PROVIDER_MODE = "fixture";
    process.env.NODE_ENV = "test";
    requireObserveOwnerMock.mockResolvedValue({ website: { hostname: "example.com" } });
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "model-1",
      status: "confirmed",
      understanding: { hostname: "example.com", languages: { htmlLangs: ["en"] } },
      confirmed: {
        confirmedAt: "2026-10-01T00:00:00.000Z",
        offers: ["silk paint"],
      },
    });
    findLatestCompatibleResearchRunMock.mockResolvedValue({
      id: "run-1",
      status: "completed",
      siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
      offeringSeeds: ["silk paint"],
      providerEnvironment: "fixture",
      countryKey: "US",
      countryName: "United States",
      languageCodes: ["en"],
      gscQueriesTruncated: false,
      completedAt: "2026-10-10T00:00:00.000Z",
      createdAt: "2026-10-10T00:00:00.000Z",
      lastProgressAt: "2026-10-10T00:00:00.000Z",
      requestLedger: [],
    });
    listResearchIdeasForRunMock.mockResolvedValue([
      {
        id: "idea-1",
        keyword: "fixture related term one",
        estimatedMonthlySearches: 50,
        seedOffering: "silk paint",
        languageCode: "en",
        createdAt: "2026-10-10T00:00:00.000Z",
        initialGscSampleStatus: "not_in_current_gsc_sample",
      },
    ]);
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([]);
    listInspectionsForResearchIdeasMock.mockResolvedValue(new Map());
  });

  it("recomputes current GSC status without treating a new sync as research staleness", async () => {
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      { id: "sync-new", queriesTruncated: false },
    ]);
    listEvidenceForSyncMock.mockResolvedValue([
      { evidenceType: "query", queryText: "fixture related term one" },
    ]);

    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.stale).toBe(false);
    expect(view.run?.ideas[0]?.initialGscSampleStatus).toBe("not_in_current_gsc_sample");
    expect(view.run?.ideas[0]?.currentGscSampleStatus).toBe("in_current_gsc_sample");
    expect(view.readiness.surfaceVisible).toBe(true);
  });

  it("marks current GSC unavailable after disconnect while keeping external evidence", async () => {
    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.ideas[0]?.currentGscSampleStatus).toBe("gsc_unavailable");
    expect(view.run?.ideas[0]?.keyword).toBe("fixture related term one");
    expect(view.run?.ideas[0]?.canInspect).toBe(true);
    expect(view.run?.ideas[0]?.inspection).toBeNull();
  });

  it("attaches a persisted related-demand inspection to the RESEARCH idea", async () => {
    listInspectionsForResearchIdeasMock.mockResolvedValue(
      new Map([
        [
          "idea-1",
          {
            decisionId: "d-1",
            runId: "inspect-1",
            state: "no_obvious_match_in_current_crawl",
            resultCopy: "Foundfy did not find an obvious match in the current crawl sample.",
            gscCopy: "Google Search evidence is not available for this inspection.",
            crawlBounded: true,
            crawlBoundedCopy:
              "This inspection used the current crawl sample: 10 pages fetched from 347 discovered URLs.",
            nextStepCopy: "Review current pages and evidence. Foundfy is not recommending a change yet.",
          },
        ],
      ]),
    );
    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.ideas[0]?.inspection?.state).toBe("no_obvious_match_in_current_crawl");
    expect(view.run?.ideas[0]?.inspection?.gscCopy).toMatch(/not available/);
    expect(view.run?.ideas[0]?.canInspect).toBe(true);
    expect(listInspectionsForResearchIdeasMock).toHaveBeenCalledWith({
      websiteId: "site-1",
      ideaIds: ["idea-1"],
    });
  });

  it("hides the RESEARCH surface when the provider is disabled", async () => {
    const view = await loadResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      env: { ...process.env, RESEARCH_PROVIDER_MODE: "disabled" },
    });
    expect(view.readiness.surfaceVisible).toBe(false);
    expect(view.run).toBeNull();
    expect(findLatestCompatibleResearchRunMock).not.toHaveBeenCalled();
  });

  it("hides fixture and sandbox runs in production", async () => {
    const production = {
      ...process.env,
      NODE_ENV: "production",
      RESEARCH_PROVIDER_MODE: "fixture",
      RESEARCH_LIVE_ENABLED: "false",
    };
    const fixtureView = await loadResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      env: production,
    });
    expect(fixtureView.readiness.surfaceVisible).toBe(false);
    expect(fixtureView.run).toBeNull();

    const sandboxView = await loadResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      env: { ...production, RESEARCH_PROVIDER_MODE: "sandbox" },
    });
    expect(sandboxView.readiness.surfaceVisible).toBe(false);
    expect(sandboxView.run).toBeNull();
    expect(findLatestCompatibleResearchRunMock).not.toHaveBeenCalled();
  });

  it("loads persisted live RESEARCH in production when live execution is disabled", async () => {
    findLatestCompatibleResearchRunMock.mockResolvedValue({
      id: "run-live",
      status: "completed",
      siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
      offeringSeeds: ["silk paint"],
      providerEnvironment: "live",
      countryKey: "US",
      countryName: "United States",
      languageCodes: ["en"],
      gscQueriesTruncated: false,
      completedAt: "2026-10-10T00:00:00.000Z",
      createdAt: "2026-10-10T00:00:00.000Z",
    });
    listResearchIdeasForRunMock.mockResolvedValue([
      {
        id: "idea-live",
        keyword: "como pintar en seda",
        estimatedMonthlySearches: 20,
        seedOffering: "silk paint",
        languageCode: "es",
        createdAt: "2026-10-10T00:00:00.000Z",
        initialGscSampleStatus: "not_in_current_gsc_sample",
      },
    ]);
    const view = await loadResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      env: {
        ...process.env,
        NODE_ENV: "production",
        RESEARCH_PROVIDER_MODE: "live",
        RESEARCH_LIVE_ENABLED: "false",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
      },
    });
    expect(view.readiness.surfaceVisible).toBe(true);
    expect(view.readiness.executionAvailable).toBe(false);
    expect(view.run?.providerEnvironment).toBe("live");
    expect(view.run?.ideas[0]?.keyword).toBe("como pintar en seda");
    expect(view.run?.ideas[0]?.canInspect).toBe(true);
    expect(findLatestCompatibleResearchRunMock).toHaveBeenCalledWith({
      websiteId: "site-1",
      environment: "live",
    });
  });

  it("does not create or refresh RESEARCH when production live execution is disabled and nothing is persisted", async () => {
    findLatestCompatibleResearchRunMock.mockResolvedValue(null);
    const view = await loadResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      env: {
        ...process.env,
        NODE_ENV: "production",
        RESEARCH_PROVIDER_MODE: "live",
        RESEARCH_LIVE_ENABLED: "false",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
      },
    });
    expect(view.readiness.surfaceVisible).toBe(true);
    expect(view.readiness.executionAvailable).toBe(false);
    expect(view.run).toBeNull();
    expect(listResearchIdeasForRunMock).not.toHaveBeenCalled();
    expect(listInspectionsForResearchIdeasMock).not.toHaveBeenCalled();
  });

  it("loads live-environment RESEARCH in production when live is enabled", async () => {
    findLatestCompatibleResearchRunMock.mockResolvedValue({
      id: "run-live",
      status: "completed",
      siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
      offeringSeeds: ["silk paint"],
      providerEnvironment: "live",
      countryKey: "US",
      countryName: "United States",
      languageCodes: ["en"],
      gscQueriesTruncated: false,
      completedAt: "2026-10-10T00:00:00.000Z",
      createdAt: "2026-10-10T00:00:00.000Z",
    });
    const view = await loadResearchForOwner({
      websiteId: "site-1",
      sessionToken: "session",
      env: {
        ...process.env,
        NODE_ENV: "production",
        RESEARCH_PROVIDER_MODE: "live",
        RESEARCH_LIVE_ENABLED: "true",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
      },
    });
    expect(view.readiness.surfaceVisible).toBe(true);
    expect(findLatestCompatibleResearchRunMock).toHaveBeenCalledWith({
      websiteId: "site-1",
      environment: "live",
    });
    expect(view.run?.providerEnvironment).toBe("live");
  });

  it("reports abandoned active runs as recovery-required without mutating them", async () => {
    findLatestCompatibleResearchRunMock.mockResolvedValue({
      id: "run-abandoned",
      status: "running",
      siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
      offeringSeeds: ["silk paint"],
      providerEnvironment: "fixture",
      countryKey: "US",
      countryName: "United States",
      languageCodes: ["en"],
      gscQueriesTruncated: false,
      completedAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      lastProgressAt: "2026-09-01T00:00:00.000Z",
      requestLedger: [
        {
          requestKey: researchRequestKey("silk paint", "en"),
          seedOffering: "silk paint",
          languageCode: "en",
          locationCode: 2840,
          providerTaskId: null,
          status: "pending",
          requestedAt: "2026-09-01T00:00:00.000Z",
          attemptedAt: null,
          retrievedAt: null,
          ideaCount: 0,
          providerResultCount: null,
          filterReasonCounts: null,
          providerCost: null,
          failureCode: null,
        },
      ],
    });
    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.recoveryRequired).toBe(true);
    expect(view.run?.displayInterrupted).toBe(true);
    expect(view.run?.canResumeUnattempted).toBe(true);
    expect(findLatestCompatibleResearchRunMock).toHaveBeenCalledTimes(1);
  });

  it("shows closed historical evidence as closed and eligible for a later new cycle", async () => {
    findLatestCompatibleResearchRunMock.mockResolvedValue({
      id: "run-closed",
      status: "closed",
      siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
      offeringSeeds: ["silk paint"],
      providerEnvironment: "fixture",
      countryKey: "US",
      countryName: "United States",
      languageCodes: ["en"],
      gscQueriesTruncated: false,
      completedAt: null,
      closedAt: "2026-10-11T00:00:00.000Z",
      createdAt: "2026-10-10T00:00:00.000Z",
      requestLedger: [
        {
          requestKey: researchRequestKey("silk paint", "en"),
          seedOffering: "silk paint",
          languageCode: "en",
          locationCode: 2840,
          providerTaskId: "task-1",
          status: "in_flight",
          requestedAt: "2026-10-10T00:00:00.000Z",
          attemptedAt: "2026-10-10T00:00:01.000Z",
          retrievedAt: null,
          ideaCount: 0,
          providerResultCount: null,
          filterReasonCounts: null,
          providerCost: null,
          failureCode: null,
        },
      ],
    });
    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.displayClosed).toBe(true);
    expect(view.run?.ideas[0]?.canInspect).toBe(false);
    expect(view.run?.canStartNewCycle).toBe(true);
    expect(view.run?.displayInterrupted).toBe(false);
    expect(view.run?.canClose).toBe(false);
    expect(view.run?.incomplete).toBe(true);
    expect(view.run?.ideas[0]?.keyword).toBe("fixture related term one");
  });

  it("does not mark the first live production timestamp pair stale and keeps historical empty unknown", async () => {
    listResearchIdeasForRunMock.mockResolvedValue([]);
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "42dce699-616d-44e2-90e0-0e14163b82f3",
      status: "stale",
      understanding: { hostname: "foundfy.me", languages: { htmlLangs: ["en"] } },
      confirmed: {
        confirmedAt: "2026-10-13T09:52:17.945Z",
        offers: ["SEO audit for small businesses"],
      },
    });
    findLatestCompatibleResearchRunMock.mockResolvedValue({
      id: "105f3d46-5bb9-4825-bf0d-f1b1a50c8ea2",
      status: "completed",
      siteModelId: "42dce699-616d-44e2-90e0-0e14163b82f3",
      siteModelConfirmedAt: "2026-10-13T09:52:17.945+00:00",
      offeringSeeds: ["SEO audit for small businesses"],
      providerEnvironment: "live",
      countryKey: "US",
      countryName: "United States",
      languageCodes: ["en"],
      gscQueriesTruncated: false,
      completedAt: "2026-10-13T22:59:14.62+00:00",
      createdAt: "2026-10-13T22:59:09.499191+00:00",
      lastProgressAt: "2026-10-13T22:59:14.902166+00:00",
      requestLedger: [
        {
          requestKey: researchRequestKey("SEO audit for small businesses", "en"),
          seedOffering: "SEO audit for small businesses",
          languageCode: "en",
          locationCode: 2840,
          providerTaskId: "10132259-2775-0368-0000-fceca571f57f",
          status: "zero_results",
          requestedAt: "2026-10-13T22:59:09.633Z",
          attemptedAt: "2026-10-13T22:59:10.051Z",
          retrievedAt: "2026-10-13T22:59:14.556Z",
          ideaCount: 0,
          providerCost: 0.09,
          failureCode: null,
          filterReasonCounts: null,
        },
      ],
    });
    process.env.RESEARCH_PROVIDER_MODE = "live";
    process.env.RESEARCH_LIVE_ENABLED = "true";
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    process.env.NODE_ENV = "production";

    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.stale).toBe(false);
    expect(view.run?.staleReasons).toEqual([]);
    expect(view.run?.emptyOutcome).toBe("unknown");
    expect(view.run?.ideas).toEqual([]);
    expect(view.run?.reviewedKeptCopy).toBeNull();
    expect(view.run?.filterReasonDetails).toEqual([]);
  });

  it("loads the historical DBHobby 3-to-1 run with generic provenance and no invented reasons", async () => {
    listResearchIdeasForRunMock.mockResolvedValue([
      {
        id: "477889f4-ce3e-401b-88f6-57fd25e30df2",
        keyword: "como pintar en seda",
        estimatedMonthlySearches: 20,
        seedOffering: "Materiales para pintura sobre seda",
        languageCode: "es",
        createdAt: "2026-10-15T12:54:36.812882+00:00",
        initialGscSampleStatus: "not_in_current_gsc_sample",
      },
    ]);
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "011f7a71-ebc0-4938-ba04-af8ddbe674bd",
      status: "stale",
      understanding: { hostname: "dbhobby.com", languages: { htmlLangs: ["ca", "es", "en"] } },
      confirmed: {
        confirmedAt: "2026-10-15T12:37:56.457+00:00",
        offers: ["Materiales para pintura sobre seda"],
      },
    });
    findLatestCompatibleResearchRunMock.mockResolvedValue({
      id: "6a99b0dd-91c5-43df-9b65-8443331ed4a6",
      status: "completed",
      siteModelId: "011f7a71-ebc0-4938-ba04-af8ddbe674bd",
      siteModelConfirmedAt: "2026-10-15T12:37:56.457+00:00",
      offeringSeeds: ["Materiales para pintura sobre seda"],
      providerEnvironment: "live",
      countryKey: "ES",
      countryName: "Spain",
      languageCodes: ["es"],
      gscQueriesTruncated: true,
      completedAt: "2026-10-15T12:54:36.952+00:00",
      createdAt: "2026-10-15T12:54:32.80692+00:00",
      requestLedger: [
        {
          requestKey: researchRequestKey("Materiales para pintura sobre seda", "es"),
          seedOffering: "Materiales para pintura sobre seda",
          languageCode: "es",
          locationCode: 2724,
          providerTaskId: "10151254-2775-0368-0000-6c3fca93a594",
          status: "succeeded",
          requestedAt: "2026-10-15T12:54:32.939Z",
          attemptedAt: "2026-10-15T12:54:33.385Z",
          retrievedAt: "2026-10-15T12:54:36.812Z",
          ideaCount: 1,
          providerResultCount: 3,
          filterReasonCounts: null,
          providerCost: 0.09,
          failureCode: null,
        },
      ],
    });
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      { id: "c2048065-dfe4-404f-a680-4e24e4c4200e", queriesTruncated: true },
    ]);
    listEvidenceForSyncMock.mockResolvedValue([]);
    process.env.RESEARCH_PROVIDER_MODE = "live";
    process.env.RESEARCH_LIVE_ENABLED = "false";
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    process.env.NODE_ENV = "production";

    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.readiness.surfaceVisible).toBe(true);
    expect(view.readiness.executionAvailable).toBe(false);
    expect(view.run?.ideas).toHaveLength(1);
    expect(view.run?.ideas[0]?.keyword).toBe("como pintar en seda");
    expect(view.run?.ideas[0]?.canInspect).toBe(true);
    expect(view.run?.ideas[0]?.currentGscSampleStatus).toBe("not_in_current_gsc_sample");
    expect(view.run?.reviewedKeptCopy).toBe(
      "Foundfy reviewed 3 related searches and kept 1 that met its research criteria.",
    );
    expect(view.run?.filterReasonDetails).toEqual([]);
    expect(view.run?.stale).toBe(false);
  });
});
