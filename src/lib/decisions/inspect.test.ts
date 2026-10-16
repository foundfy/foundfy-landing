import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObserveAuthError } from "@/lib/gsc/types";
import { opportunityCompactKey } from "@/lib/opportunities/normalize";
import {
  INSPECT_GSC_UNAVAILABLE_COPY,
  INSPECT_RELATED_DEMAND_TYPE,
} from "./inspect-display";
import type { InspectPageEvidence } from "./inspect-match";
import type { ResearchInspectDecisionRecord, ResearchInspectState } from "./types";

const requireObserveOwnerMock = vi.fn();
const findResearchIdeaForWebsiteMock = vi.fn();
const findResearchRunForWebsiteMock = vi.fn();
const findLatestCompatibleResearchRunMock = vi.fn();
const findLatestConfirmedSiteModelForWebsiteMock = vi.fn();
const findLatestUsableCrawlRunMock = vi.fn();
const listCompletedSearchSyncsForWebsiteMock = vi.fn();
const listEvidenceForSyncMock = vi.fn();
const findInspectCrawlMock = vi.fn();
const listInspectPagesForCrawlMock = vi.fn();
const findCompletedInspectRunMock = vi.fn();
const loadInspectDecisionMock = vi.fn();
const persistResearchInspectDecisionMock = vi.fn();

vi.mock("@/lib/gsc/observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwnerMock(...args),
}));

vi.mock("@/lib/research/repository", () => ({
  findResearchIdeaForWebsite: (...args: unknown[]) => findResearchIdeaForWebsiteMock(...args),
  findResearchRunForWebsite: (...args: unknown[]) => findResearchRunForWebsiteMock(...args),
  findLatestCompatibleResearchRun: (...args: unknown[]) =>
    findLatestCompatibleResearchRunMock(...args),
}));

vi.mock("@/lib/site-model/repository", () => ({
  findLatestConfirmedSiteModelForWebsite: (...args: unknown[]) =>
    findLatestConfirmedSiteModelForWebsiteMock(...args),
}));

vi.mock("@/lib/websites/repository", () => ({
  findLatestUsableCrawlRun: (...args: unknown[]) => findLatestUsableCrawlRunMock(...args),
}));

vi.mock("@/lib/gsc/db-search", () => ({
  listCompletedSearchSyncsForWebsite: (...args: unknown[]) =>
    listCompletedSearchSyncsForWebsiteMock(...args),
  listEvidenceForSync: (...args: unknown[]) => listEvidenceForSyncMock(...args),
}));

vi.mock("./inspect-db", () => ({
  findInspectCrawl: (...args: unknown[]) => findInspectCrawlMock(...args),
  listInspectPagesForCrawl: (...args: unknown[]) => listInspectPagesForCrawlMock(...args),
  findCompletedInspectRun: (...args: unknown[]) => findCompletedInspectRunMock(...args),
  loadInspectDecision: (...args: unknown[]) => loadInspectDecisionMock(...args),
  persistResearchInspectDecision: (...args: unknown[]) => persistResearchInspectDecisionMock(...args),
  listCompletedInspectRunsForIdeas: vi.fn(),
}));

import { inspectRelatedDemandForOwner } from "./inspect";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const IDEA_ID = "477889f4-ce3e-401b-88f6-57fd25e30df2";
const RUN_ID = "6a99b0dd-91c5-43df-9b65-8443331ed4a6";
const MODEL_ID = "011f7a71-ebc0-4938-ba04-af8ddbe674bd";
const CRAWL_ID = "crawl-dbhobby-1";
const OFFERING = "Materiales para pintura sobre seda";
const CONFIRMED_AT = "2026-10-15T12:37:56.457+00:00";

const DBHOBBY_PAGES: InspectPageEvidence[] = [
  {
    id: "es-home",
    requestedUrl: "https://www.dbhobby.com/es",
    finalUrl: "https://www.dbhobby.com/es",
    title: "Pintura en seda | DBHOBBY",
    h1: [],
    metaDescription: null,
    excerpt: "Pintura Arasilk para seda",
    htmlLang: "es",
    urlLocale: "es",
    canonical: "https://www.dbhobby.com/es/pintura-en-seda",
  },
  {
    id: "gutta",
    requestedUrl: "https://dbhobby.com/es/gutta-para-seda",
    finalUrl: "https://dbhobby.com/es/gutta-para-seda",
    title: "DBHOBBY | Pintura sobre seda",
    h1: [],
    metaDescription: null,
    excerpt: "38,33 €",
    htmlLang: "es",
    urlLocale: "es",
    canonical: null,
  },
  {
    id: "vapor",
    requestedUrl: "https://dbhobby.com/es/pintura-seda/fijacion-del-color-con-vapor",
    finalUrl: "https://dbhobby.com/es/pintura-seda/fijacion-del-color-con-vapor",
    title: "Fijación del color con vapor | DBHOBBY",
    h1: ["Fijación del color con vapor"],
    metaDescription: null,
    excerpt: "pieza de seda, será la fijadora",
    htmlLang: "es",
    urlLocale: "es",
    canonical: null,
  },
  {
    id: "ciano",
    requestedUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
    finalUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
    title: "Set de cianotipo | DBHOBBY",
    h1: ["Set de cianotipo"],
    metaDescription: null,
    excerpt: "25,80 €",
    htmlLang: "es",
    urlLocale: "es",
    canonical: null,
  },
];

function idea(overrides: Record<string, unknown> = {}) {
  return {
    id: IDEA_ID,
    runId: RUN_ID,
    websiteId: WEBSITE_ID,
    seedOffering: OFFERING,
    languageCode: "es",
    providerTaskId: "task-1",
    keyword: "como pintar en seda",
    compactKey: opportunityCompactKey("como pintar en seda"),
    estimatedMonthlySearches: 20,
    providerResultOrder: 1,
    initialGscSampleStatus: "not_in_current_gsc_sample",
    requestKey: "request-1",
    createdAt: "2026-10-15T12:54:36.812Z",
    ...overrides,
  };
}

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: RUN_ID,
    websiteId: WEBSITE_ID,
    siteModelId: MODEL_ID,
    siteModelConfirmedAt: CONFIRMED_AT,
    requestedBy: "owner-1",
    gscSyncId: null,
    gscQueriesTruncated: true,
    countryKey: "ES",
    countryName: "Spain",
    locationCode: 2724,
    languageCodes: ["es"],
    offeringSeeds: [OFFERING],
    provider: "dataforseo",
    providerEnvironment: "live",
    status: "completed",
    requestFingerprint: "fp",
    requestLedger: [],
    providerCost: 0.09,
    failureCode: null,
    failureMessage: null,
    createdAt: "2026-10-15T12:54:32.806Z",
    startedAt: "2026-10-15T12:54:33.000Z",
    completedAt: "2026-10-15T12:54:36.952Z",
    updatedAt: "2026-10-15T12:54:36.952Z",
    lastProgressAt: "2026-10-15T12:54:36.952Z",
    executionGeneration: 1,
    closedAt: null,
    ...overrides,
  };
}

function model(overrides: Record<string, unknown> = {}) {
  return {
    id: MODEL_ID,
    status: "confirmed",
    understanding: { hostname: "dbhobby.com", languages: { htmlLangs: ["ca", "es", "en"] } },
    confirmed: {
      confirmedAt: CONFIRMED_AT,
      offers: [OFFERING],
    },
    ...overrides,
  };
}

function crawl(overrides: Record<string, unknown> = {}) {
  return {
    id: CRAWL_ID,
    websiteId: WEBSITE_ID,
    pagesCrawled: 10,
    maxPages: 10,
    ...overrides,
  };
}

function storedDecision(
  overrides: Partial<ResearchInspectDecisionRecord> &
    Pick<ResearchInspectDecisionRecord, "title" | "explanation" | "evidenceRefs">,
  runId = "inspect-run-1",
): ResearchInspectDecisionRecord {
  return {
    decisionType: INSPECT_RELATED_DEMAND_TYPE,
    pageUrl: null,
    pageId: null,
    priorityBand: null,
    rank: null,
    scoring: null,
    confidence: null,
    inspectionState: "no_obvious_match_in_current_crawl",
    id: "decision-inspect-1",
    decisionRunId: runId,
    websiteId: WEBSITE_ID,
    createdAt: "2026-10-15T13:00:00.000Z",
    ...overrides,
  };
}

type PersistInspectInput = {
  researchIdeaId: string;
  siteModelId: string;
  crawlRunId: string;
  gscSearchSyncId: string | null;
  title: string;
  explanation: string;
  pageUrl: string | null;
  pageId: string | null;
  inspectionState: ResearchInspectState;
  gscTruncated: boolean;
  evidenceRefs: ResearchInspectDecisionRecord["evidenceRefs"];
};

let lastPersist: PersistInspectInput | null = null;

function bindPersistToStoredDecision() {
  persistResearchInspectDecisionMock.mockImplementation(async (input: PersistInspectInput) => {
    lastPersist = input;
    return { reused: false, runId: "inspect-run-1", decisionId: "decision-inspect-1" };
  });
  loadInspectDecisionMock.mockImplementation(async () => {
    if (!lastPersist) {
      return null;
    }
    return storedDecision({
      title: lastPersist.title,
      explanation: lastPersist.explanation,
      pageUrl: lastPersist.pageUrl,
      pageId: lastPersist.pageId,
      inspectionState: lastPersist.inspectionState,
      evidenceRefs: lastPersist.evidenceRefs,
    });
  });
}

describe("inspectRelatedDemandForOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireObserveOwnerMock.mockResolvedValue({ website: { id: WEBSITE_ID } });
    findResearchIdeaForWebsiteMock.mockResolvedValue(idea());
    findResearchRunForWebsiteMock.mockResolvedValue(run());
    findLatestCompatibleResearchRunMock.mockResolvedValue(run());
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue(model());
    findLatestUsableCrawlRunMock.mockResolvedValue(crawl());
    findInspectCrawlMock.mockResolvedValue({
      id: CRAWL_ID,
      pagesCrawled: 10,
      pagesDiscovered: 347,
    });
    listInspectPagesForCrawlMock.mockResolvedValue(DBHOBBY_PAGES);
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([]);
    listEvidenceForSyncMock.mockResolvedValue([]);
    findCompletedInspectRunMock.mockResolvedValue(null);
    lastPersist = null;
    bindPersistToStoredDecision();
  });

  it("requires an observe-owner session", async () => {
    requireObserveOwnerMock.mockRejectedValue(new ObserveAuthError(401, "Owner session required."));
    await expect(
      inspectRelatedDemandForOwner({ websiteId: WEBSITE_ID, ideaId: IDEA_ID, sessionToken: null }),
    ).rejects.toBeInstanceOf(ObserveAuthError);
    expect(persistResearchInspectDecisionMock).not.toHaveBeenCalled();
  });

  it("blocks a missing idea, incomplete run, draft model, removed offering, stale run, and missing crawl", async () => {
    findResearchIdeaForWebsiteMock.mockResolvedValueOnce(null);
    await expect(
      inspectRelatedDemandForOwner({ websiteId: WEBSITE_ID, ideaId: IDEA_ID, sessionToken: "s" }),
    ).rejects.toMatchObject({ code: "idea_not_found" });

    findResearchRunForWebsiteMock.mockResolvedValueOnce(run({ status: "running" }));
    await expect(
      inspectRelatedDemandForOwner({ websiteId: WEBSITE_ID, ideaId: IDEA_ID, sessionToken: "s" }),
    ).rejects.toMatchObject({ code: "run_not_completed" });

    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValueOnce({
      id: MODEL_ID,
      status: "draft",
      understanding: { hostname: "dbhobby.com", languages: { htmlLangs: ["es"] } },
      confirmed: null,
    });
    await expect(
      inspectRelatedDemandForOwner({ websiteId: WEBSITE_ID, ideaId: IDEA_ID, sessionToken: "s" }),
    ).rejects.toMatchObject({ code: "no_confirmed_site_model" });

    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValueOnce(
      model({ confirmed: { confirmedAt: CONFIRMED_AT, offers: ["other offering"] } }),
    );
    await expect(
      inspectRelatedDemandForOwner({ websiteId: WEBSITE_ID, ideaId: IDEA_ID, sessionToken: "s" }),
    ).rejects.toMatchObject({ code: "offering_removed" });

    findLatestCompatibleResearchRunMock.mockResolvedValueOnce(run({ id: "newer-run" }));
    await expect(
      inspectRelatedDemandForOwner({ websiteId: WEBSITE_ID, ideaId: IDEA_ID, sessionToken: "s" }),
    ).rejects.toMatchObject({ code: "research_stale" });

    findLatestUsableCrawlRunMock.mockResolvedValueOnce(null);
    await expect(
      inspectRelatedDemandForOwner({ websiteId: WEBSITE_ID, ideaId: IDEA_ID, sessionToken: "s" }),
    ).rejects.toMatchObject({ code: "no_usable_crawl" });

    expect(persistResearchInspectDecisionMock).not.toHaveBeenCalled();
  });

  it("allows a confirmed-but-stale Site Model when RESEARCH evidence is still current", async () => {
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue(
      model({ status: "stale" }),
    );
    const view = await inspectRelatedDemandForOwner({
      websiteId: WEBSITE_ID,
      ideaId: IDEA_ID,
      sessionToken: "s",
    });
    expect(view.state).toBe("no_obvious_match_in_current_crawl");
    expect(persistResearchInspectDecisionMock).toHaveBeenCalled();
  });

  it("does not treat a discovered-but-unfetched canonical as current page evidence", async () => {
    const view = await inspectRelatedDemandForOwner({
      websiteId: WEBSITE_ID,
      ideaId: IDEA_ID,
      sessionToken: "s",
    });
    expect(view.state).toBe("no_obvious_match_in_current_crawl");
    expect(lastPersist?.evidenceRefs.some((ref) => ref.kind === "page")).toBe(false);
    expect(DBHOBBY_PAGES.some((page) => page.requestedUrl.includes("pintura-en-seda"))).toBe(false);
  });

  it("records DBHobby como pintar en seda as no obvious match with bounded crawl caveats", async () => {
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      {
        id: "gsc-1",
        pagesTruncated: false,
        queriesTruncated: true,
        queryPagesTruncated: false,
      },
    ]);
    listEvidenceForSyncMock.mockResolvedValue([
      { evidenceType: "query", queryText: "pintura en seda" },
    ]);

    const view = await inspectRelatedDemandForOwner({
      websiteId: WEBSITE_ID,
      ideaId: IDEA_ID,
      sessionToken: "s",
    });
    expect(view.state).toBe("no_obvious_match_in_current_crawl");
    expect(view.resultCopy).toBe("Foundfy did not find an obvious match in the current crawl sample.");
    expect(view.crawlBounded).toBe(true);
    expect(view.crawlBoundedCopy).toBe(
      "This inspection used the current crawl sample: 10 pages fetched from 347 discovered URLs.",
    );
    expect(lastPersist?.explanation).toMatch(/10 pages fetched from 347 discovered URLs/);
    expect(lastPersist?.explanation).not.toMatch(/create a page|content gap|missing page/i);
    expect(persistResearchInspectDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        gscSearchSyncId: "gsc-1",
        researchIdeaId: IDEA_ID,
        crawlRunId: CRAWL_ID,
      }),
    );
    expect(lastPersist?.evidenceRefs.map((ref) => ref.kind)).toEqual(
      expect.arrayContaining(["research_idea", "research_run", "site_model", "crawl_run", "gsc_sync"]),
    );
    expect(lastPersist?.evidenceRefs.some((ref) => ref.kind === "goal")).toBe(false);
    expect(lastPersist?.evidenceRefs.find((ref) => ref.kind === "research_idea")?.snapshot.gscStatus).toBe(
      "not_in_current_gsc_sample",
    );
    expect(lastPersist?.inspectionState).toBe("no_obvious_match_in_current_crawl");
    expect(lastPersist).not.toHaveProperty("rank");
    expect(lastPersist).not.toHaveProperty("priorityBand");
    expect(lastPersist).not.toHaveProperty("confidence");
    expect(lastPersist).not.toHaveProperty("scoring");
    expect(view.gscCopy).toMatch(/not present in the current Google Search sample/);
    expect(view.gscCopy).toMatch(/bounded/);
  });

  it("treats exact GSC query presence as factual sample evidence only", async () => {
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      { id: "gsc-exact", pagesTruncated: false, queriesTruncated: false, queryPagesTruncated: false },
    ]);
    listEvidenceForSyncMock.mockResolvedValue([
      { evidenceType: "query", queryText: "como pintar en seda" },
    ]);
    const view = await inspectRelatedDemandForOwner({
      websiteId: WEBSITE_ID,
      ideaId: IDEA_ID,
      sessionToken: "s",
    });
    expect(view.state).toBe("no_obvious_match_in_current_crawl");
    expect(view.gscCopy).toBe("This related search is present in the current Google Search sample.");
    expect(view.gscCopy).not.toMatch(/ranks|traffic|Google wants/i);
  });

  it("succeeds without GSC or a goal and does not invent dummy evidence", async () => {
    const view = await inspectRelatedDemandForOwner({
      websiteId: WEBSITE_ID,
      ideaId: IDEA_ID,
      sessionToken: "s",
    });
    expect(view.state).toBe("no_obvious_match_in_current_crawl");
    expect(view.gscCopy).toBe(INSPECT_GSC_UNAVAILABLE_COPY);
    expect(view.gscCopy).not.toMatch(/not in Google|does not rank|no search visibility/i);
    expect(persistResearchInspectDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        gscSearchSyncId: null,
        researchIdeaId: IDEA_ID,
      }),
    );
    expect(listEvidenceForSyncMock).not.toHaveBeenCalled();
    expect(lastPersist?.evidenceRefs.some((ref) => ref.kind === "gsc_sync")).toBe(false);
    expect(lastPersist?.evidenceRefs.some((ref) => ref.kind === "goal")).toBe(false);
    expect(lastPersist?.evidenceRefs.some((ref) => ref.kind === "gsc_evidence")).toBe(false);
  });

  it("reuses the same no-GSC inspection for a repeated owner click", async () => {
    const existing = storedDecision({
      title: "Check whether current pages cover “como pintar en seda”",
      explanation: "reuse",
      inspectionState: "no_obvious_match_in_current_crawl",
      evidenceRefs: [
        {
          kind: "research_idea",
          recordId: IDEA_ID,
          snapshot: {
            resultState: "no_obvious_match_in_current_crawl",
            gscCopy: INSPECT_GSC_UNAVAILABLE_COPY,
          },
        },
        { kind: "crawl_run", recordId: CRAWL_ID, snapshot: { bounded: true } },
      ],
    });
    findCompletedInspectRunMock.mockResolvedValue({
      id: "inspect-run-existing",
      researchIdeaId: IDEA_ID,
      gscSearchSyncId: null,
    });
    loadInspectDecisionMock.mockResolvedValue(existing);

    const view = await inspectRelatedDemandForOwner({
      websiteId: WEBSITE_ID,
      ideaId: IDEA_ID,
      sessionToken: "s",
    });
    expect(view.decisionId).toBe("decision-inspect-1");
    expect(view.gscCopy).toBe(INSPECT_GSC_UNAVAILABLE_COPY);
    expect(findCompletedInspectRunMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      researchIdeaId: IDEA_ID,
      crawlRunId: CRAWL_ID,
      gscSearchSyncId: null,
    });
    expect(persistResearchInspectDecisionMock).not.toHaveBeenCalled();
  });

  it("reuses the same GSC inspection and allows a new identity for a new crawl or GSC sync", async () => {
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      { id: "gsc-old", pagesTruncated: false, queriesTruncated: false, queryPagesTruncated: false },
    ]);
    findCompletedInspectRunMock.mockResolvedValue({
      id: "inspect-run-gsc",
      researchIdeaId: IDEA_ID,
      gscSearchSyncId: "gsc-old",
    });
    loadInspectDecisionMock.mockResolvedValue(
      storedDecision({
        title: "existing",
        explanation: "existing",
        inspectionState: "ambiguous",
        evidenceRefs: [
          {
            kind: "research_idea",
            recordId: IDEA_ID,
            snapshot: { resultState: "ambiguous", gscCopy: "present" },
          },
        ],
      }),
    );

    const reused = await inspectRelatedDemandForOwner({
      websiteId: WEBSITE_ID,
      ideaId: IDEA_ID,
      sessionToken: "s",
    });
    expect(reused.state).toBe("ambiguous");
    expect(persistResearchInspectDecisionMock).not.toHaveBeenCalled();
    expect(findCompletedInspectRunMock).toHaveBeenCalledWith(
      expect.objectContaining({ gscSearchSyncId: "gsc-old", crawlRunId: CRAWL_ID }),
    );

    findCompletedInspectRunMock.mockResolvedValue(null);
    bindPersistToStoredDecision();
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      { id: "gsc-new", pagesTruncated: false, queriesTruncated: false, queryPagesTruncated: false },
    ]);
    await inspectRelatedDemandForOwner({
      websiteId: WEBSITE_ID,
      ideaId: IDEA_ID,
      sessionToken: "s",
    });
    expect(persistResearchInspectDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({ gscSearchSyncId: "gsc-new", crawlRunId: CRAWL_ID }),
    );

    persistResearchInspectDecisionMock.mockClear();
    lastPersist = null;
    findLatestUsableCrawlRunMock.mockResolvedValue(crawl({ id: "crawl-2" }));
    findInspectCrawlMock.mockResolvedValue({ id: "crawl-2", pagesCrawled: 10, pagesDiscovered: 10 });
    await inspectRelatedDemandForOwner({
      websiteId: WEBSITE_ID,
      ideaId: IDEA_ID,
      sessionToken: "s",
    });
    expect(persistResearchInspectDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({ crawlRunId: "crawl-2", gscSearchSyncId: "gsc-new" }),
    );
  });

  it("persists a clear page match without enabling ACT", async () => {
    listInspectPagesForCrawlMock.mockResolvedValue([
      {
        id: "page-clear",
        requestedUrl: "https://dbhobby.com/es/como-pintar-en-seda",
        finalUrl: "https://dbhobby.com/es/como-pintar-en-seda",
        title: "Como pintar en seda",
        h1: [],
        metaDescription: null,
        excerpt: null,
        htmlLang: "es",
        urlLocale: "es",
        canonical: null,
      },
    ]);
    findInspectCrawlMock.mockResolvedValue({
      id: CRAWL_ID,
      pagesCrawled: 10,
      pagesDiscovered: 10,
    });
    const view = await inspectRelatedDemandForOwner({
      websiteId: WEBSITE_ID,
      ideaId: IDEA_ID,
      sessionToken: "s",
    });
    expect(view.state).toBe("clear_existing_page_evidence");
    expect(lastPersist?.pageId).toBe("page-clear");
    expect(lastPersist?.inspectionState).toBe("clear_existing_page_evidence");
    expect(lastPersist).not.toHaveProperty("scoring");
    expect(lastPersist).not.toHaveProperty("confidence");
    expect(lastPersist).not.toHaveProperty("rank");
    expect(lastPersist).not.toHaveProperty("priorityBand");
  });

  it("inspects persisted evidence while live execution is disabled", async () => {
    const original = { ...process.env };
    process.env.NODE_ENV = "production";
    process.env.RESEARCH_PROVIDER_MODE = "live";
    process.env.RESEARCH_LIVE_ENABLED = "false";
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    try {
      const view = await inspectRelatedDemandForOwner({
        websiteId: WEBSITE_ID,
        ideaId: IDEA_ID,
        sessionToken: "s",
      });
      expect(view.state).toBe("no_obvious_match_in_current_crawl");
      expect(persistResearchInspectDecisionMock).toHaveBeenCalled();
      expect(findLatestCompatibleResearchRunMock).toHaveBeenCalled();
    } finally {
      process.env = original;
    }
  });

  it("returns the same inspection to concurrent same-identity callers", async () => {
    const winner = { reused: false, runId: "inspect-run-shared", decisionId: "decision-inspect-1" };
    persistResearchInspectDecisionMock
      .mockResolvedValueOnce({ ...winner, reused: false })
      .mockResolvedValueOnce({ ...winner, reused: true });
    loadInspectDecisionMock.mockResolvedValue(
      storedDecision(
        {
          title: "shared",
          explanation: "shared",
          inspectionState: "no_obvious_match_in_current_crawl",
          evidenceRefs: [
            {
              kind: "research_idea",
              recordId: IDEA_ID,
              snapshot: {
                resultState: "no_obvious_match_in_current_crawl",
                gscCopy: INSPECT_GSC_UNAVAILABLE_COPY,
              },
            },
            {
              kind: "crawl_run",
              recordId: CRAWL_ID,
              snapshot: { bounded: true, pagesCrawled: 10, pagesDiscovered: 347 },
            },
          ],
        },
        "inspect-run-shared",
      ),
    );

    const [first, second] = await Promise.all([
      inspectRelatedDemandForOwner({
        websiteId: WEBSITE_ID,
        ideaId: IDEA_ID,
        sessionToken: "s",
      }),
      inspectRelatedDemandForOwner({
        websiteId: WEBSITE_ID,
        ideaId: IDEA_ID,
        sessionToken: "s",
      }),
    ]);

    expect(first.runId).toBe("inspect-run-shared");
    expect(second.runId).toBe("inspect-run-shared");
    expect(first.decisionId).toBe(second.decisionId);
    expect(persistResearchInspectDecisionMock).toHaveBeenCalledTimes(2);
  });

  it("returns the same with-GSC inspection to concurrent callers", async () => {
    listCompletedSearchSyncsForWebsiteMock.mockResolvedValue([
      { id: "gsc-1", pagesTruncated: false, queriesTruncated: false, queryPagesTruncated: false },
    ]);
    persistResearchInspectDecisionMock.mockResolvedValue({
      reused: true,
      runId: "inspect-run-gsc-shared",
      decisionId: "decision-inspect-1",
    });
    loadInspectDecisionMock.mockResolvedValue(
      storedDecision(
        {
          title: "shared gsc",
          explanation: "shared gsc",
          inspectionState: "no_obvious_match_in_current_crawl",
          evidenceRefs: [
            {
              kind: "research_idea",
              recordId: IDEA_ID,
              snapshot: { resultState: "no_obvious_match_in_current_crawl", gscCopy: "present" },
            },
          ],
        },
        "inspect-run-gsc-shared",
      ),
    );

    const [first, second] = await Promise.all([
      inspectRelatedDemandForOwner({
        websiteId: WEBSITE_ID,
        ideaId: IDEA_ID,
        sessionToken: "s",
      }),
      inspectRelatedDemandForOwner({
        websiteId: WEBSITE_ID,
        ideaId: IDEA_ID,
        sessionToken: "s",
      }),
    ]);

    expect(first.runId).toBe(second.runId);
    expect(first.decisionId).toBe(second.decisionId);
    expect(persistResearchInspectDecisionMock).toHaveBeenCalledWith(
      expect.objectContaining({ gscSearchSyncId: "gsc-1" }),
    );
  });

  it("does not leave a durable inspection after persistence failure, then succeeds", async () => {
    persistResearchInspectDecisionMock.mockRejectedValueOnce(new Error("forced persist failure"));
    await expect(
      inspectRelatedDemandForOwner({
        websiteId: WEBSITE_ID,
        ideaId: IDEA_ID,
        sessionToken: "s",
      }),
    ).rejects.toThrow(/forced persist failure/);
    expect(loadInspectDecisionMock).not.toHaveBeenCalled();

    bindPersistToStoredDecision();
    const view = await inspectRelatedDemandForOwner({
      websiteId: WEBSITE_ID,
      ideaId: IDEA_ID,
      sessionToken: "s",
    });
    expect(view.state).toBe("no_obvious_match_in_current_crawl");
    expect(persistResearchInspectDecisionMock).toHaveBeenCalledTimes(2);
  });
});
