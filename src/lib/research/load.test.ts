import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireObserveOwnerMock = vi.fn();
const findLatestConfirmedSiteModelForWebsiteMock = vi.fn();
const listCompletedSearchSyncsForWebsiteMock = vi.fn();
const listEvidenceForSyncMock = vi.fn();
const findLatestCompatibleResearchRunMock = vi.fn();
const listReadableCompletedResearchRunsMock = vi.fn();
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
  listReadableCompletedResearchRuns: (...args: unknown[]) =>
    listReadableCompletedResearchRunsMock(...args),
  listResearchIdeasForRun: (...args: unknown[]) => listResearchIdeasForRunMock(...args),
}));

const listInspectionsForResearchIdeasMock = vi.fn();
const findLatestUsableCrawlRunMock = vi.fn();

vi.mock("@/lib/decisions/inspect", () => ({
  listInspectionsForResearchIdeas: (...args: unknown[]) =>
    listInspectionsForResearchIdeasMock(...args),
}));

vi.mock("@/lib/websites/repository", () => ({
  findLatestUsableCrawlRun: (...args: unknown[]) => findLatestUsableCrawlRunMock(...args),
}));

import { RESEARCH_REUSE_WINDOW_MS } from "./config";
import { loadResearchForOwner } from "./load";
import { researchRequestKey } from "./request-key";

const originalEnv = { ...process.env };

function setRunHistory(runs: Array<Record<string, unknown>>) {
  findLatestCompatibleResearchRunMock.mockResolvedValue(runs[0] ?? null);
  listReadableCompletedResearchRunsMock.mockResolvedValue(
    runs.filter((run) => run.status === "completed" && run.closedAt == null),
  );
}

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
    setRunHistory([
      {
        id: "run-1",
        status: "completed",
        siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
        offeringSeeds: ["silk paint"],
        providerEnvironment: "fixture",
        countryKey: "US",
        countryName: "United States",
        languageCodes: ["en"],
        requestFingerprint: "fp-en",
        gscQueriesTruncated: false,
        completedAt: "2026-10-10T00:00:00.000Z",
        createdAt: "2026-10-10T00:00:00.000Z",
        lastProgressAt: "2026-10-10T00:00:00.000Z",
        requestLedger: [],
      },
    ]);
    listResearchIdeasForRunMock.mockResolvedValue([
      {
        id: "idea-1",
        runId: "run-1",
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
    findLatestUsableCrawlRunMock.mockResolvedValue({ id: "crawl-1", pagesCrawled: 10 });
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
            websiteId: "site-1",
            researchIdeaId: "idea-1",
            crawlRunId: "crawl-1",
            targetedObservationId: null,
            state: "no_obvious_match_in_current_crawl",
            pageRelationship: "none_in_crawl_sample",
            opportunityCopy: "Check whether current pages cover “fixture related term one”",
            pageRelationshipCopy:
              "Foundfy did not find an obvious match in the current crawl sample.",
            pageUrl: null,
            pageTitle: null,
            resultCopy: "Foundfy did not find an obvious match in the current crawl sample.",
            evidenceCopy:
              "Foundfy compared this search with fetched pages in the current crawl sample.",
            limitationCopy:
              "This inspection used the current crawl sample: 10 pages fetched from 347 discovered URLs.",
            cannotConcludeCopy:
              "This check covers fetched pages in the current crawl sample, not the whole site. Foundfy is not recommending that you add content.",
            gscCopy: "Google Search evidence is not available for this inspection.",
            gscAvailable: false,
            crawlBounded: true,
            crawlBoundedCopy:
              "This inspection used the current crawl sample: 10 pages fetched from 347 discovered URLs.",
            nextStepCopy: "Review the current crawl sample. Foundfy is not recommending a new page.",
            current: true,
          },
        ],
      ]),
    );
    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.ideas[0]?.inspection?.state).toBe("no_obvious_match_in_current_crawl");
    expect(view.run?.ideas[0]?.inspection?.gscCopy).toMatch(/not available/);
    expect(view.run?.ideas[0]?.inspection?.current).toBe(true);
    expect(view.run?.ideas[0]?.canInspect).toBe(true);
    expect(listInspectionsForResearchIdeasMock).toHaveBeenCalledWith({
      websiteId: "site-1",
      ideaIds: ["idea-1"],
    });
  });

  it("does not treat a newer usable crawl as a current inspection recommendation", async () => {
    findLatestUsableCrawlRunMock.mockResolvedValue({ id: "crawl-2", pagesCrawled: 12 });
    listInspectionsForResearchIdeasMock.mockResolvedValue(
      new Map([
        [
          "idea-1",
          {
            decisionId: "d-1",
            runId: "inspect-1",
            websiteId: "site-1",
            researchIdeaId: "idea-1",
            crawlRunId: "crawl-1",
            targetedObservationId: null,
            state: "no_obvious_match_in_current_crawl",
            pageRelationship: "none_in_crawl_sample",
            opportunityCopy: "Check whether current pages cover “fixture related term one”",
            pageRelationshipCopy: "Foundfy did not find an obvious match in the current crawl sample.",
            pageUrl: null,
            pageTitle: null,
            resultCopy: "Foundfy did not find an obvious match in the current crawl sample.",
            evidenceCopy: "Foundfy compared this search with fetched pages in the current crawl sample.",
            limitationCopy: null,
            cannotConcludeCopy: "not the whole site",
            gscCopy: "Google Search evidence is not available for this inspection.",
            gscAvailable: false,
            crawlBounded: false,
            crawlBoundedCopy: null,
            nextStepCopy: "Review the current crawl sample. Foundfy is not recommending a new page.",
            current: true,
          },
        ],
      ]),
    );

    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.ideas[0]?.inspection?.resultCopy).toMatch(/did not find an obvious match/);
    expect(view.run?.ideas[0]?.inspection?.current).toBe(false);
    expect(view.run?.ideas[0]?.canInspect).toBe(true);
  });

  it("does not treat offering-removed research as a current inspection recommendation", async () => {
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "model-1",
      status: "confirmed",
      understanding: { hostname: "example.com", languages: { htmlLangs: ["en"] } },
      confirmed: {
        confirmedAt: "2026-10-01T00:00:00.000Z",
        offers: ["other offering"],
      },
    });
    listInspectionsForResearchIdeasMock.mockResolvedValue(
      new Map([
        [
          "idea-1",
          {
            decisionId: "d-1",
            runId: "inspect-1",
            websiteId: "site-1",
            researchIdeaId: "idea-1",
            crawlRunId: "crawl-1",
            targetedObservationId: null,
            state: "clear_existing_page_evidence",
            pageRelationship: "clear_existing_page",
            opportunityCopy: "Check whether current pages cover “fixture related term one”",
            pageRelationshipCopy: "Foundfy found a current crawled page with clear text matching this related search.",
            pageUrl: "https://www.example.com/guide",
            pageTitle: "Guide",
            resultCopy: "Foundfy found a current crawled page with clear text matching this related search.",
            evidenceCopy: "Foundfy identified this page from crawled text.",
            limitationCopy: null,
            cannotConcludeCopy: "A text match does not mean this page needs optimization.",
            gscCopy: "Google Search evidence is not available for this inspection.",
            gscAvailable: false,
            crawlBounded: false,
            crawlBoundedCopy: null,
            nextStepCopy: "Review whether this page adequately addresses what the searcher would expect.",
            current: true,
          },
        ],
      ]),
    );

    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.staleReasons).toContain("offerings_changed");
    expect(view.run?.ideas[0]?.canInspect).toBe(false);
    expect(view.run?.ideas[0]?.inspection?.pageUrl).toBe("https://www.example.com/guide");
    expect(view.run?.ideas[0]?.inspection?.current).toBe(false);
  });

  it("keeps inspections on their own ideas and does not rebase frozen GSC copy from a newer sync", async () => {
    listResearchIdeasForRunMock.mockResolvedValue([
      {
        id: "idea-1",
        runId: "run-1",
        keyword: "fixture related term one",
        estimatedMonthlySearches: 50,
        seedOffering: "silk paint",
        languageCode: "en",
        createdAt: "2026-10-10T00:00:00.000Z",
        initialGscSampleStatus: "not_in_current_gsc_sample",
      },
      {
        id: "idea-2",
        runId: "run-1",
        keyword: "fixture related term two",
        estimatedMonthlySearches: 40,
        seedOffering: "silk paint",
        languageCode: "en",
        createdAt: "2026-10-10T00:00:00.000Z",
        initialGscSampleStatus: "not_in_current_gsc_sample",
      },
    ]);
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      { id: "sync-newer", queriesTruncated: false },
    ]);
    listEvidenceForSyncMock.mockResolvedValue([
      { evidenceType: "query", queryText: "fixture related term one" },
    ]);
    listInspectionsForResearchIdeasMock.mockResolvedValue(
      new Map([
        [
          "idea-1",
          {
            decisionId: "d-a",
            runId: "inspect-a",
            websiteId: "site-1",
            researchIdeaId: "idea-1",
            crawlRunId: "crawl-1",
            targetedObservationId: "obs-1",
            state: "clear_existing_page_evidence",
            pageRelationship: "clear_existing_page",
            opportunityCopy: "Check whether current pages cover “fixture related term one”",
            pageRelationshipCopy: "Foundfy found a current crawled page with clear text matching this related search.",
            pageUrl: "https://www.example.com/one",
            pageTitle: "One",
            resultCopy: "Foundfy found a current crawled page with clear text matching this related search.",
            evidenceCopy: "Foundfy identified this page from crawled text.",
            limitationCopy: null,
            cannotConcludeCopy: "A text match does not mean this page needs optimization.",
            gscCopy: "This related search is not present in the current Google Search sample.",
            gscAvailable: true,
            crawlBounded: false,
            crawlBoundedCopy: null,
            nextStepCopy: "Review whether this page adequately addresses what the searcher would expect.",
            current: true,
          },
        ],
        [
          "idea-2",
          {
            decisionId: "d-b",
            runId: "inspect-b",
            websiteId: "site-1",
            researchIdeaId: "idea-2",
            crawlRunId: "crawl-1",
            targetedObservationId: null,
            state: "no_obvious_match_in_current_crawl",
            pageRelationship: "none_in_crawl_sample",
            opportunityCopy: "Check whether current pages cover “fixture related term two”",
            pageRelationshipCopy: "Foundfy did not find an obvious match in the current crawl sample.",
            pageUrl: null,
            pageTitle: null,
            resultCopy: "Foundfy did not find an obvious match in the current crawl sample.",
            evidenceCopy: "Foundfy compared this search with fetched pages in the current crawl sample.",
            limitationCopy: null,
            cannotConcludeCopy: "not the whole site",
            gscCopy: "Google Search evidence is not available for this inspection.",
            gscAvailable: false,
            crawlBounded: false,
            crawlBoundedCopy: null,
            nextStepCopy: "Review the current crawl sample. Foundfy is not recommending a new page.",
            current: true,
          },
        ],
      ]),
    );

    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.ideas[0]?.id).toBe("idea-1");
    expect(view.run?.ideas[0]?.inspection?.decisionId).toBe("d-a");
    expect(view.run?.ideas[0]?.inspection?.pageUrl).toBe("https://www.example.com/one");
    expect(view.run?.ideas[0]?.currentGscSampleStatus).toBe("in_current_gsc_sample");
    expect(view.run?.ideas[0]?.inspection?.gscCopy).toBe(
      "This related search is not present in the current Google Search sample.",
    );
    expect(view.run?.ideas[0]?.inspection?.current).toBe(true);
    expect(view.run?.ideas[1]?.id).toBe("idea-2");
    expect(view.run?.ideas[1]?.inspection?.decisionId).toBe("d-b");
    expect(view.run?.ideas[1]?.inspection?.pageUrl).toBeNull();
    expect(view.run?.ideas[1]?.inspection?.gscCopy).toMatch(/not available/);
    expect(listInspectionsForResearchIdeasMock).toHaveBeenCalledWith({
      websiteId: "site-1",
      ideaIds: ["idea-1", "idea-2"],
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
    expect(listReadableCompletedResearchRunsMock).not.toHaveBeenCalled();
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
    expect(listReadableCompletedResearchRunsMock).not.toHaveBeenCalled();
  });

  it("loads persisted live RESEARCH in production when live execution is disabled", async () => {
    setRunHistory([
      {
        id: "run-live",
        status: "completed",
        siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
        offeringSeeds: ["silk paint"],
        providerEnvironment: "live",
        countryKey: "US",
        countryName: "United States",
        languageCodes: ["en"],
        requestFingerprint: "fp-es",
        gscQueriesTruncated: false,
        completedAt: "2026-10-10T00:00:00.000Z",
        createdAt: "2026-10-10T00:00:00.000Z",
      },
    ]);
    listResearchIdeasForRunMock.mockResolvedValue([
      {
        id: "idea-live",
        runId: "run-live",
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
    expect(listReadableCompletedResearchRunsMock).toHaveBeenCalledWith({
      websiteId: "site-1",
      environment: "live",
    });
  });

  it("does not create or refresh RESEARCH when production live execution is disabled and nothing is persisted", async () => {
    setRunHistory([]);
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
    expect(view.persistedRuns).toEqual([]);
    expect(listResearchIdeasForRunMock).not.toHaveBeenCalled();
    expect(listInspectionsForResearchIdeasMock).not.toHaveBeenCalled();
  });

  it("loads live-environment RESEARCH in production when live is enabled", async () => {
    setRunHistory([
      {
        id: "run-live",
        status: "completed",
        siteModelConfirmedAt: "2026-10-01T00:00:00.000Z",
        offeringSeeds: ["silk paint"],
        providerEnvironment: "live",
        countryKey: "US",
        countryName: "United States",
        languageCodes: ["en"],
        requestFingerprint: "fp-en",
        gscQueriesTruncated: false,
        completedAt: "2026-10-10T00:00:00.000Z",
        createdAt: "2026-10-10T00:00:00.000Z",
      },
    ]);
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
    expect(listReadableCompletedResearchRunsMock).toHaveBeenCalledWith({
      websiteId: "site-1",
      environment: "live",
    });
    expect(view.run?.providerEnvironment).toBe("live");
  });

  it("reports abandoned active runs as recovery-required without mutating them", async () => {
    setRunHistory([
      {
      id: "run-abandoned",
      requestFingerprint: "fp-en",
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
    },
    ]);
    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.recoveryRequired).toBe(true);
    expect(view.run?.displayInterrupted).toBe(true);
    expect(view.run?.canResumeUnattempted).toBe(true);
    expect(findLatestCompatibleResearchRunMock).toHaveBeenCalledTimes(1);
    expect(listReadableCompletedResearchRunsMock).toHaveBeenCalledTimes(1);
  });

  it("shows closed historical evidence as closed and eligible for a later new cycle", async () => {
    setRunHistory([
      {
      id: "run-closed",
      requestFingerprint: "fp-en",
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
    },
    ]);
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
    setRunHistory([
      {
      id: "105f3d46-5bb9-4825-bf0d-f1b1a50c8ea2",
      requestFingerprint: "fp-foundfy-en",
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
    },
    ]);
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
        runId: "6a99b0dd-91c5-43df-9b65-8443331ed4a6",
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
    setRunHistory([
      {
      id: "6a99b0dd-91c5-43df-9b65-8443331ed4a6",
      requestFingerprint: "fp-es",
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
    },
    ]);
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
    expect(view.persistedRuns).toEqual([]);
  });

  it("returns the current Spanish idea when a later Catalan fingerprint is the website-latest run", async () => {
    const spanishRun = {
      id: "6a99b0dd-91c5-43df-9b65-8443331ed4a6",
      status: "completed" as const,
      siteModelConfirmedAt: "2026-10-15T12:37:56.457+00:00",
      offeringSeeds: ["Materiales para pintura sobre seda"],
      providerEnvironment: "live" as const,
      countryKey: "ES",
      countryName: "Spain",
      languageCodes: ["es"],
      requestFingerprint: "fp-es",
      gscQueriesTruncated: true,
      completedAt: "2026-10-15T12:54:36.952+00:00",
      createdAt: "2026-10-15T12:54:32.80692+00:00",
      requestLedger: [
        {
          requestKey: researchRequestKey("Materiales para pintura sobre seda", "es"),
          seedOffering: "Materiales para pintura sobre seda",
          languageCode: "es",
          locationCode: 2724,
          providerTaskId: "task-es",
          status: "succeeded" as const,
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
    };
    const catalanRun = {
      id: "32dd4ebc-94a9-463f-827b-fd5b9d16d4a9",
      status: "completed" as const,
      siteModelConfirmedAt: "2026-10-15T12:37:56.457+00:00",
      offeringSeeds: ["Materiales para pintura sobre seda"],
      providerEnvironment: "live" as const,
      countryKey: "ES",
      countryName: "Spain",
      languageCodes: ["ca"],
      requestFingerprint: "fp-ca",
      gscQueriesTruncated: true,
      completedAt: "2026-10-15T20:32:58.531+00:00",
      createdAt: "2026-10-15T20:32:55.092742+00:00",
      requestLedger: [
        {
          requestKey: researchRequestKey("Materiales para pintura sobre seda", "ca"),
          seedOffering: "Materiales para pintura sobre seda",
          languageCode: "ca",
          locationCode: 2724,
          providerTaskId: "task-ca",
          status: "zero_results" as const,
          requestedAt: "2026-10-15T20:32:55.200Z",
          attemptedAt: "2026-10-15T20:32:55.400Z",
          retrievedAt: "2026-10-15T20:32:58.400Z",
          ideaCount: 0,
          providerResultCount: 2,
          filterReasonCounts: {
            emptyCount: 0,
            invalidCount: 0,
            brandOnlyCount: 0,
            seedDuplicateCount: 2,
            compactDuplicateCount: 0,
            cappedCount: 0,
          },
          providerCost: 0.09,
          failureCode: null,
        },
      ],
    };
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "011f7a71-ebc0-4938-ba04-af8ddbe674bd",
      status: "stale",
      understanding: { hostname: "dbhobby.com", languages: { htmlLangs: ["ca", "es", "en"] } },
      confirmed: {
        confirmedAt: "2026-10-15T12:37:56.457+00:00",
        offers: ["Materiales para pintura sobre seda"],
      },
    });
    setRunHistory([catalanRun, spanishRun]);
    listResearchIdeasForRunMock.mockImplementation(async (runId: string) => {
      if (runId === spanishRun.id) {
        return [
          {
            id: "477889f4-ce3e-401b-88f6-57fd25e30df2",
            runId: spanishRun.id,
            keyword: "como pintar en seda",
            estimatedMonthlySearches: 20,
            seedOffering: "Materiales para pintura sobre seda",
            languageCode: "es",
            createdAt: "2026-10-15T12:54:36.812882+00:00",
            initialGscSampleStatus: "not_in_current_gsc_sample",
          },
        ];
      }
      return [];
    });
    process.env.RESEARCH_PROVIDER_MODE = "live";
    process.env.RESEARCH_LIVE_ENABLED = "false";
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    process.env.NODE_ENV = "production";

    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.readiness.executionAvailable).toBe(false);
    expect(view.run?.id).toBe(catalanRun.id);
    expect(view.run?.languageCodes).toEqual(["ca"]);
    expect(view.run?.ideas).toEqual([]);
    expect(view.run?.filterReasonDetails.join(" ")).toMatch(/matched the confirmed offering/);
    expect(view.persistedRuns).toHaveLength(1);
    expect(view.persistedRuns[0]?.id).toBe(spanishRun.id);
    expect(view.persistedRuns[0]?.languageCodes).toEqual(["es"]);
    expect(view.persistedRuns[0]?.ideas[0]?.runId).toBe(spanishRun.id);
    expect(view.persistedRuns[0]?.ideas[0]?.keyword).toBe("como pintar en seda");
    expect(view.persistedRuns[0]?.ideas[0]?.languageCode).toBe("es");
    expect(view.persistedRuns[0]?.ideas[0]?.countryName).toBe("Spain");
    expect(view.persistedRuns[0]?.ideas[0]?.estimatedMonthlySearches).toBe(20);
    expect(view.persistedRuns[0]?.ideas[0]?.canInspect).toBe(true);
  });

  it("keeps older current Spanish evidence when a newer same-fingerprint run is not a valid successor", async () => {
    const spanishRun = {
      id: "6a99b0dd-91c5-43df-9b65-8443331ed4a6",
      status: "completed" as const,
      siteModelConfirmedAt: "2026-10-15T12:37:56.457+00:00",
      offeringSeeds: ["Materiales para pintura sobre seda"],
      providerEnvironment: "live" as const,
      countryKey: "ES",
      countryName: "Spain",
      languageCodes: ["es"],
      requestFingerprint: "fp-es",
      gscQueriesTruncated: true,
      completedAt: "2026-10-15T12:54:36.952+00:00",
      createdAt: "2026-10-15T12:54:32.80692+00:00",
      requestLedger: [],
    };
    const failedSuccessor = {
      ...spanishRun,
      id: "es-failed-newer",
      status: "failed" as const,
      completedAt: null,
      createdAt: "2026-10-16T12:54:32.80692+00:00",
    };
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "011f7a71-ebc0-4938-ba04-af8ddbe674bd",
      status: "stale",
      understanding: { hostname: "dbhobby.com", languages: { htmlLangs: ["es"] } },
      confirmed: {
        confirmedAt: "2026-10-15T12:37:56.457+00:00",
        offers: ["Materiales para pintura sobre seda"],
      },
    });
    setRunHistory([failedSuccessor, spanishRun]);
    listResearchIdeasForRunMock.mockImplementation(async (runId: string) =>
      runId === spanishRun.id
        ? [
            {
              id: "477889f4-ce3e-401b-88f6-57fd25e30df2",
              runId: spanishRun.id,
              keyword: "como pintar en seda",
              estimatedMonthlySearches: 20,
              seedOffering: "Materiales para pintura sobre seda",
              languageCode: "es",
              createdAt: "2026-10-15T12:54:36.812882+00:00",
              initialGscSampleStatus: "not_in_current_gsc_sample",
            },
          ]
        : [],
    );
    process.env.RESEARCH_PROVIDER_MODE = "live";
    process.env.RESEARCH_LIVE_ENABLED = "false";
    process.env.NODE_ENV = "production";

    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.id).toBe(failedSuccessor.id);
    expect(view.persistedRuns[0]?.id).toBe(spanishRun.id);
    expect(view.persistedRuns[0]?.ideas[0]?.canInspect).toBe(true);
  });

  it("omits an older Spanish idea after a newer valid same-fingerprint completed run", async () => {
    const older = {
      id: "es-older",
      status: "completed" as const,
      siteModelConfirmedAt: "2026-10-15T12:37:56.457+00:00",
      offeringSeeds: ["Materiales para pintura sobre seda"],
      providerEnvironment: "live" as const,
      countryKey: "ES",
      countryName: "Spain",
      languageCodes: ["es"],
      requestFingerprint: "fp-es",
      gscQueriesTruncated: true,
      completedAt: "2026-10-15T12:54:36.952+00:00",
      createdAt: "2026-10-15T12:54:32.80692+00:00",
      requestLedger: [],
    };
    const newer = {
      ...older,
      id: "es-newer",
      completedAt: "2026-10-16T12:54:36.952+00:00",
      createdAt: "2026-10-16T12:54:32.80692+00:00",
    };
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "011f7a71-ebc0-4938-ba04-af8ddbe674bd",
      status: "stale",
      understanding: { hostname: "dbhobby.com", languages: { htmlLangs: ["es"] } },
      confirmed: {
        confirmedAt: "2026-10-15T12:37:56.457+00:00",
        offers: ["Materiales para pintura sobre seda"],
      },
    });
    setRunHistory([newer, older]);
    listResearchIdeasForRunMock.mockImplementation(async (runId: string) => {
      if (runId === older.id) {
        return [
          {
            id: "old-idea",
            runId: older.id,
            keyword: "como pintar en seda",
            estimatedMonthlySearches: 20,
            seedOffering: "Materiales para pintura sobre seda",
            languageCode: "es",
            createdAt: "2026-10-15T12:54:36.812882+00:00",
            initialGscSampleStatus: "not_in_current_gsc_sample",
          },
        ];
      }
      return [
        {
          id: "new-idea",
          runId: newer.id,
          keyword: "pintar seda",
          estimatedMonthlySearches: 10,
          seedOffering: "Materiales para pintura sobre seda",
          languageCode: "es",
          createdAt: "2026-10-16T12:54:36.812882+00:00",
          initialGscSampleStatus: "not_in_current_gsc_sample",
        },
      ];
    });
    process.env.RESEARCH_PROVIDER_MODE = "live";
    process.env.RESEARCH_LIVE_ENABLED = "false";
    process.env.NODE_ENV = "production";

    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.id).toBe(newer.id);
    expect(view.run?.ideas.map((idea) => idea.id)).toEqual(["new-idea"]);
    expect(view.run?.ideas[0]?.canInspect).toBe(true);
    expect(view.persistedRuns).toEqual([]);
  });

  it("selects a newer same-fingerprint zero-result completed run and hides the older idea", async () => {
    const older = {
      id: "es-older",
      status: "completed" as const,
      siteModelConfirmedAt: "2026-10-15T12:37:56.457+00:00",
      offeringSeeds: ["Materiales para pintura sobre seda"],
      providerEnvironment: "live" as const,
      countryKey: "ES",
      countryName: "Spain",
      languageCodes: ["es"],
      requestFingerprint: "fp-es",
      gscQueriesTruncated: true,
      completedAt: "2026-10-15T12:54:36.952+00:00",
      createdAt: "2026-10-15T12:54:32.80692+00:00",
      requestLedger: [],
    };
    const newer = {
      ...older,
      id: "es-newer-empty",
      completedAt: "2026-10-16T12:54:36.952+00:00",
      createdAt: "2026-10-16T12:54:32.80692+00:00",
      requestLedger: [
        {
          requestKey: researchRequestKey("Materiales para pintura sobre seda", "es"),
          seedOffering: "Materiales para pintura sobre seda",
          languageCode: "es",
          locationCode: 2724,
          providerTaskId: "task-es-2",
          status: "zero_results" as const,
          requestedAt: "2026-10-16T12:54:32.939Z",
          attemptedAt: "2026-10-16T12:54:33.385Z",
          retrievedAt: "2026-10-16T12:54:36.812Z",
          ideaCount: 0,
          providerResultCount: 0,
          filterReasonCounts: null,
          providerCost: 0.09,
          failureCode: null,
        },
      ],
    };
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "011f7a71-ebc0-4938-ba04-af8ddbe674bd",
      status: "stale",
      understanding: { hostname: "dbhobby.com", languages: { htmlLangs: ["es"] } },
      confirmed: {
        confirmedAt: "2026-10-15T12:37:56.457+00:00",
        offers: ["Materiales para pintura sobre seda"],
      },
    });
    setRunHistory([newer, older]);
    listResearchIdeasForRunMock.mockImplementation(async (runId: string) =>
      runId === older.id
        ? [
            {
              id: "old-idea",
              runId: older.id,
              keyword: "como pintar en seda",
              estimatedMonthlySearches: 20,
              seedOffering: "Materiales para pintura sobre seda",
              languageCode: "es",
              createdAt: "2026-10-15T12:54:36.812882+00:00",
              initialGscSampleStatus: "not_in_current_gsc_sample",
            },
          ]
        : [],
    );
    process.env.RESEARCH_PROVIDER_MODE = "live";
    process.env.RESEARCH_LIVE_ENABLED = "false";
    process.env.NODE_ENV = "production";

    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.id).toBe(newer.id);
    expect(view.run?.ideas).toEqual([]);
    expect(view.run?.emptyOutcome).toBe("provider_empty");
    expect(view.persistedRuns).toEqual([]);
    expect(view.readiness.executionAvailable).toBe(false);
  });

  it("keeps older completed Spanish evidence when a newer same-fingerprint run is requested or running", async () => {
    const spanishRun = {
      id: "6a99b0dd-91c5-43df-9b65-8443331ed4a6",
      status: "completed" as const,
      siteModelConfirmedAt: "2026-10-15T12:37:56.457+00:00",
      offeringSeeds: ["Materiales para pintura sobre seda"],
      providerEnvironment: "live" as const,
      countryKey: "ES",
      countryName: "Spain",
      languageCodes: ["es"],
      requestFingerprint: "fp-es",
      gscQueriesTruncated: true,
      completedAt: "2026-10-15T12:54:36.952+00:00",
      createdAt: "2026-10-15T12:54:32.80692+00:00",
      requestLedger: [],
    };
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "011f7a71-ebc0-4938-ba04-af8ddbe674bd",
      status: "stale",
      understanding: { hostname: "dbhobby.com", languages: { htmlLangs: ["es"] } },
      confirmed: {
        confirmedAt: "2026-10-15T12:37:56.457+00:00",
        offers: ["Materiales para pintura sobre seda"],
      },
    });
    listResearchIdeasForRunMock.mockImplementation(async (runId: string) =>
      runId === spanishRun.id
        ? [
            {
              id: "477889f4-ce3e-401b-88f6-57fd25e30df2",
              runId: spanishRun.id,
              keyword: "como pintar en seda",
              estimatedMonthlySearches: 20,
              seedOffering: "Materiales para pintura sobre seda",
              languageCode: "es",
              createdAt: "2026-10-15T12:54:36.812882+00:00",
              initialGscSampleStatus: "not_in_current_gsc_sample",
            },
          ]
        : [],
    );
    process.env.RESEARCH_PROVIDER_MODE = "live";
    process.env.RESEARCH_LIVE_ENABLED = "false";
    process.env.NODE_ENV = "production";

    for (const status of ["requested", "running"] as const) {
      const successor = {
        ...spanishRun,
        id: `es-${status}-newer`,
        status,
        completedAt: null,
        createdAt: "2026-10-16T12:54:32.80692+00:00",
      };
      setRunHistory([successor, spanishRun]);
      const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
      expect(view.run?.id).toBe(successor.id);
      expect(view.persistedRuns[0]?.id).toBe(spanishRun.id);
      expect(view.persistedRuns[0]?.ideas[0]?.keyword).toBe("como pintar en seda");
      expect(view.persistedRuns[0]?.ideas[0]?.canInspect).toBe(true);
    }
  });

  it("keeps a non-latest Spanish fingerprint readable and stale after 30 days", async () => {
    const spanishCompletedAt = new Date(Date.now() - RESEARCH_REUSE_WINDOW_MS - 60_000).toISOString();
    const spanishRun = {
      id: "6a99b0dd-91c5-43df-9b65-8443331ed4a6",
      status: "completed" as const,
      siteModelConfirmedAt: "2026-10-15T12:37:56.457+00:00",
      offeringSeeds: ["Materiales para pintura sobre seda"],
      providerEnvironment: "live" as const,
      countryKey: "ES",
      countryName: "Spain",
      languageCodes: ["es"],
      requestFingerprint: "fp-es",
      gscQueriesTruncated: true,
      completedAt: spanishCompletedAt,
      createdAt: spanishCompletedAt,
      requestLedger: [],
    };
    const catalanRun = {
      id: "32dd4ebc-94a9-463f-827b-fd5b9d16d4a9",
      status: "completed" as const,
      siteModelConfirmedAt: "2026-10-15T12:37:56.457+00:00",
      offeringSeeds: ["Materiales para pintura sobre seda"],
      providerEnvironment: "live" as const,
      countryKey: "ES",
      countryName: "Spain",
      languageCodes: ["ca"],
      requestFingerprint: "fp-ca",
      gscQueriesTruncated: true,
      completedAt: "2026-10-15T20:32:58.531+00:00",
      createdAt: "2026-10-15T20:32:55.092742+00:00",
      requestLedger: [
        {
          requestKey: researchRequestKey("Materiales para pintura sobre seda", "ca"),
          seedOffering: "Materiales para pintura sobre seda",
          languageCode: "ca",
          locationCode: 2724,
          providerTaskId: "task-ca",
          status: "zero_results" as const,
          requestedAt: "2026-10-15T20:32:55.200Z",
          attemptedAt: "2026-10-15T20:32:55.400Z",
          retrievedAt: "2026-10-15T20:32:58.400Z",
          ideaCount: 0,
          providerResultCount: 2,
          filterReasonCounts: {
            emptyCount: 0,
            invalidCount: 0,
            brandOnlyCount: 0,
            seedDuplicateCount: 2,
            compactDuplicateCount: 0,
            cappedCount: 0,
          },
          providerCost: 0.09,
          failureCode: null,
        },
      ],
    };
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "011f7a71-ebc0-4938-ba04-af8ddbe674bd",
      status: "stale",
      understanding: { hostname: "dbhobby.com", languages: { htmlLangs: ["ca", "es", "en"] } },
      confirmed: {
        confirmedAt: "2026-10-15T12:37:56.457+00:00",
        offers: ["Materiales para pintura sobre seda"],
      },
    });
    setRunHistory([catalanRun, spanishRun]);
    listResearchIdeasForRunMock.mockImplementation(async (runId: string) =>
      runId === spanishRun.id
        ? [
            {
              id: "477889f4-ce3e-401b-88f6-57fd25e30df2",
              runId: spanishRun.id,
              keyword: "como pintar en seda",
              estimatedMonthlySearches: 20,
              seedOffering: "Materiales para pintura sobre seda",
              languageCode: "es",
              createdAt: spanishCompletedAt,
              initialGscSampleStatus: "not_in_current_gsc_sample",
            },
          ]
        : [],
    );
    process.env.RESEARCH_PROVIDER_MODE = "live";
    process.env.RESEARCH_LIVE_ENABLED = "false";
    process.env.NODE_ENV = "production";

    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.id).toBe(catalanRun.id);
    expect(view.persistedRuns).toHaveLength(1);
    expect(view.persistedRuns[0]?.id).toBe(spanishRun.id);
    expect(view.persistedRuns[0]?.stale).toBe(true);
    expect(view.persistedRuns[0]?.staleReasons).toContain("older_than_30_days");
    expect(view.persistedRuns[0]?.ideas[0]?.keyword).toBe("como pintar en seda");
    expect(view.persistedRuns[0]?.ideas[0]?.canInspect).toBe(false);
    expect(view.persistedRuns[0]?.ideas[0]?.languageCode).toBe("es");
    expect(view.readiness.executionAvailable).toBe(false);
  });

  it("still returns a valid fingerprint after more than 50 newer unrelated completed runs", async () => {
    const spanishRun = {
      id: "6a99b0dd-91c5-43df-9b65-8443331ed4a6",
      status: "completed" as const,
      siteModelConfirmedAt: "2026-10-15T12:37:56.457+00:00",
      offeringSeeds: ["Materiales para pintura sobre seda"],
      providerEnvironment: "live" as const,
      countryKey: "ES",
      countryName: "Spain",
      languageCodes: ["es"],
      requestFingerprint: "fp-es",
      gscQueriesTruncated: true,
      completedAt: "2026-10-15T12:54:36.952+00:00",
      createdAt: "2026-10-15T12:54:32.80692+00:00",
      requestLedger: [],
    };
    const otherRuns = Array.from({ length: 51 }, (_, index) => ({
      id: `other-${index}`,
      status: "completed" as const,
      siteModelConfirmedAt: "2026-10-15T12:37:56.457+00:00",
      offeringSeeds: ["Materiales para pintura sobre seda"],
      providerEnvironment: "live" as const,
      countryKey: "ES",
      countryName: "Spain",
      languageCodes: ["ca"],
      requestFingerprint: `fp-other-${index}`,
      gscQueriesTruncated: true,
      completedAt: `2026-10-16T20:32:${String(index).padStart(2, "0")}.000+00:00`,
      createdAt: `2026-10-16T20:32:${String(index).padStart(2, "0")}.000+00:00`,
      requestLedger: [],
    }));
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "011f7a71-ebc0-4938-ba04-af8ddbe674bd",
      status: "stale",
      understanding: { hostname: "dbhobby.com", languages: { htmlLangs: ["ca", "es", "en"] } },
      confirmed: {
        confirmedAt: "2026-10-15T12:37:56.457+00:00",
        offers: ["Materiales para pintura sobre seda"],
      },
    });
    setRunHistory([...otherRuns, spanishRun]);
    listResearchIdeasForRunMock.mockImplementation(async (runId: string) =>
      runId === spanishRun.id
        ? [
            {
              id: "477889f4-ce3e-401b-88f6-57fd25e30df2",
              runId: spanishRun.id,
              keyword: "como pintar en seda",
              estimatedMonthlySearches: 20,
              seedOffering: "Materiales para pintura sobre seda",
              languageCode: "es",
              createdAt: "2026-10-15T12:54:36.812882+00:00",
              initialGscSampleStatus: "not_in_current_gsc_sample",
            },
          ]
        : [],
    );
    process.env.RESEARCH_PROVIDER_MODE = "live";
    process.env.RESEARCH_LIVE_ENABLED = "false";
    process.env.NODE_ENV = "production";

    const view = await loadResearchForOwner({ websiteId: "site-1", sessionToken: "session" });
    expect(view.run?.id).toBe(otherRuns[0]?.id);
    expect(view.persistedRuns.some((run) => run.id === spanishRun.id)).toBe(true);
    const spanish = view.persistedRuns.find((run) => run.id === spanishRun.id);
    expect(spanish?.ideas[0]?.keyword).toBe("como pintar en seda");
    expect(spanish?.ideas[0]?.canInspect).toBe(true);
    expect(view.persistedRuns.some((run) => run.id === view.run?.id)).toBe(false);
  });
});
