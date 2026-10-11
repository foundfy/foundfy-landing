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

import { loadResearchForOwner } from "./load";

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
});
