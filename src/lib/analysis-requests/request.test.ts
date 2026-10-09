import { beforeEach, describe, expect, it, vi } from "vitest";
import { DailyCrawlLimitReachedError } from "@/lib/crawler/daily-crawl-limit";
import { ObserveAuthError } from "@/lib/gsc/types";
import { DecisionPrerequisiteError } from "@/lib/decisions/types";
import { pageComparisonKey } from "@/lib/gsc/page-map";
import { AnalysisRequestError } from "./types";

const requireObserveOwnerMock = vi.fn();
const findDecisionByIdMock = vi.fn();
const findLatestUsableCrawlRunMock = vi.fn();
const findActiveCrawlRunForWebsiteMock = vi.fn();
const listFetchedPagesForCrawlRunMock = vi.fn();
const findActiveAnalysisRequestMock = vi.fn();
const insertAnalysisRequestMock = vi.fn();
const listAnalysisRequestsForWebsiteMock = vi.fn();
const loadDecisionPrerequisitesMock = vi.fn();
const findLatestCompletedDecisionRunMock = vi.fn();
const listEvidenceForSyncMock = vi.fn();
const listQueueItemsMock = vi.fn();
const createAndEnqueueCrawlMock = vi.fn();
const resolveRescanSeedUrlMock = vi.fn();
const resolveRescanPriorityUrlsMock = vi.fn();
const resolveOwnerGscVisibilityPagesMock = vi.fn();
const settleAnalysisRequestMock = vi.fn();

vi.mock("@/lib/gsc/observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwnerMock(...args),
}));

vi.mock("@/lib/decisions/db", () => ({
  findDecisionById: (...args: unknown[]) => findDecisionByIdMock(...args),
  findLatestCompletedDecisionRun: (...args: unknown[]) => findLatestCompletedDecisionRunMock(...args),
}));

vi.mock("@/lib/decisions/generate", () => ({
  loadDecisionPrerequisites: (...args: unknown[]) => loadDecisionPrerequisitesMock(...args),
}));

vi.mock("@/lib/websites/repository", () => ({
  findLatestUsableCrawlRun: (...args: unknown[]) => findLatestUsableCrawlRunMock(...args),
  findActiveCrawlRunForWebsite: (...args: unknown[]) => findActiveCrawlRunForWebsiteMock(...args),
}));

vi.mock("@/lib/crawler/db/repository", () => ({
  listQueueItems: (...args: unknown[]) => listQueueItemsMock(...args),
}));

vi.mock("@/lib/crawler/start-crawl", () => ({
  createAndEnqueueCrawl: (...args: unknown[]) => createAndEnqueueCrawlMock(...args),
}));

vi.mock("@/lib/websites/rescan-seed", () => ({
  resolveRescanSeedUrl: (...args: unknown[]) => resolveRescanSeedUrlMock(...args),
}));

vi.mock("@/lib/websites/rescan-priority-urls", () => ({
  resolveRescanPriorityUrls: (...args: unknown[]) => resolveRescanPriorityUrlsMock(...args),
}));

vi.mock("@/lib/crawler/select/gsc-visibility", () => ({
  resolveOwnerGscVisibilityPages: (...args: unknown[]) =>
    resolveOwnerGscVisibilityPagesMock(...args),
}));

vi.mock("@/lib/gsc/db-search", () => ({
  listEvidenceForSync: (...args: unknown[]) => listEvidenceForSyncMock(...args),
}));

vi.mock("./settle", () => ({
  settleAnalysisRequest: (...args: unknown[]) => settleAnalysisRequestMock(...args),
}));

vi.mock("./db", () => ({
  listFetchedPagesForCrawlRun: (...args: unknown[]) => listFetchedPagesForCrawlRunMock(...args),
  findActiveAnalysisRequest: (...args: unknown[]) => findActiveAnalysisRequestMock(...args),
  insertAnalysisRequest: (...args: unknown[]) => insertAnalysisRequestMock(...args),
  listAnalysisRequestsForWebsite: (...args: unknown[]) =>
    listAnalysisRequestsForWebsiteMock(...args),
  toAnalysisRequestView: (record: {
    id: string;
    decisionId: string | null;
    requestedUrl: string;
    crawlRunId: string | null;
    resultPageId: string | null;
    status: string;
    failureReason: string | null;
    requestedAt: string;
  }) => ({
    id: record.id,
    decisionId: record.decisionId,
    requestedUrl: record.requestedUrl,
    crawlRunId: record.crawlRunId,
    resultPageId: record.resultPageId,
    status: record.status,
    failureReason: record.failureReason,
    requestedAt: record.requestedAt,
  }),
}));

import { listAnalysisRequestsForOwner, requestPageAnalysis } from "./request";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const REQUIRED = "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo";
const REQUIRED_KEY = pageComparisonKey(REQUIRED);

const website = {
  id: WEBSITE_ID,
  hostname: "dbhobby.com",
  displayUrl: "https://dbhobby.com/",
};

const ownerContext = {
  website,
  owner: { id: "owner-1" },
};

const typeB = {
  id: "decision-1",
  websiteId: WEBSITE_ID,
  decisionRunId: "drun-1",
  decisionType: "inspect_unanalyzed_page" as const,
  pageId: null,
  pageUrl: REQUIRED,
  evidenceRefs: [
    { kind: "gsc_evidence" as const, recordId: "gsc-1", snapshot: { impressions: 201, clicks: 1 } },
  ],
};

const currentRun = {
  id: "drun-1",
  siteModelId: "model-1",
  crawlRunId: "old-crawl",
  gscSearchSyncId: "sync-1",
  goalSnapshot: { id: "goal-1", updatedAt: "2026-10-01T00:00:00.000Z" },
};

const prerequisites = {
  siteModel: { id: "model-1" },
  crawl: { id: "old-crawl" },
  sync: { id: "sync-1" },
  goal: { id: "goal-1", updatedAt: "2026-10-01T00:00:00.000Z" },
};

function inserted(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    decisionId: "decision-1",
    requestedUrl: REQUIRED,
    crawlRunId: "new-crawl",
    resultPageId: null,
    status,
    failureReason: null,
    requestedAt: "2026-10-09T00:00:00.000Z",
    ...extra,
  };
}

describe("requestPageAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireObserveOwnerMock.mockResolvedValue(ownerContext);
    findDecisionByIdMock.mockResolvedValue(typeB);
    findLatestUsableCrawlRunMock.mockResolvedValue({ id: "old-crawl" });
    listFetchedPagesForCrawlRunMock.mockResolvedValue([]);
    findActiveAnalysisRequestMock.mockResolvedValue(null);
    loadDecisionPrerequisitesMock.mockResolvedValue(prerequisites);
    findLatestCompletedDecisionRunMock.mockResolvedValue(currentRun);
    listEvidenceForSyncMock.mockResolvedValue([
      { evidenceType: "page", pageUrl: REQUIRED },
    ]);
    findActiveCrawlRunForWebsiteMock.mockResolvedValue(null);
    resolveRescanSeedUrlMock.mockResolvedValue("https://dbhobby.com/");
    resolveRescanPriorityUrlsMock.mockResolvedValue([]);
    resolveOwnerGscVisibilityPagesMock.mockResolvedValue([
      { url: "https://www.dbhobby.com/es/pintura-en-seda" },
    ]);
    createAndEnqueueCrawlMock.mockResolvedValue({
      crawlRunId: "new-crawl",
      websiteId: WEBSITE_ID,
    });
    insertAnalysisRequestMock.mockImplementation(async (input: Record<string, unknown>) =>
      inserted(String(input.status), input),
    );
  });

  it("starts a normal 10-page crawl with the required Type B URL", async () => {
    const view = await requestPageAnalysis({
      websiteId: WEBSITE_ID,
      sessionToken: "owner-token",
      decisionId: "decision-1",
    });

    expect(createAndEnqueueCrawlMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      seedUrl: "https://dbhobby.com/",
      priorityUrls: [],
      requiredUrl: REQUIRED,
      gscVisibilityUrls: ["https://www.dbhobby.com/es/pintura-en-seda"],
    });
    expect(view.status).toBe("requested");
    expect(view.crawlRunId).toBe("new-crawl");
    expect(view.requestedUrl).toBe(REQUIRED);
  });

  it("reuses an in-flight request instead of starting another crawl", async () => {
    const active = inserted("running", { crawlRunId: "active-crawl" });
    findActiveAnalysisRequestMock.mockResolvedValue(active);
    settleAnalysisRequestMock.mockResolvedValue(active);

    const first = await requestPageAnalysis({
      websiteId: WEBSITE_ID,
      sessionToken: "owner-token",
      decisionId: "decision-1",
    });
    const second = await requestPageAnalysis({
      websiteId: WEBSITE_ID,
      sessionToken: "owner-token",
      decisionId: "decision-1",
    });

    expect(createAndEnqueueCrawlMock).not.toHaveBeenCalled();
    expect(first.id).toBe(second.id);
    expect(findActiveAnalysisRequestMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      requestedUrlKey: REQUIRED_KEY,
    });
  });

  it("treats an already fetched page as analyzed without starting a crawl", async () => {
    listFetchedPagesForCrawlRunMock.mockResolvedValue([
      {
        id: "page-1",
        requestedUrl: REQUIRED,
        finalUrl: REQUIRED,
      },
    ]);

    const view = await requestPageAnalysis({
      websiteId: WEBSITE_ID,
      sessionToken: "owner-token",
      decisionId: "decision-1",
    });

    expect(createAndEnqueueCrawlMock).not.toHaveBeenCalled();
    expect(view.status).toBe("analyzed");
    expect(view.resultPageId).toBe("page-1");
  });

  it("denies a stale Decision", async () => {
    findLatestCompletedDecisionRunMock.mockResolvedValue({
      ...currentRun,
      crawlRunId: "newer-crawl",
    });

    await expect(
      requestPageAnalysis({
        websiteId: WEBSITE_ID,
        sessionToken: "owner-token",
        decisionId: "decision-1",
      }),
    ).rejects.toMatchObject({ code: "decision_stale" });
    expect(createAndEnqueueCrawlMock).not.toHaveBeenCalled();
  });

  it("denies missing current GSC evidence", async () => {
    listEvidenceForSyncMock.mockResolvedValue([]);

    await expect(
      requestPageAnalysis({
        websiteId: WEBSITE_ID,
        sessionToken: "owner-token",
        decisionId: "decision-1",
      }),
    ).rejects.toMatchObject({ code: "missing_gsc_evidence" });
  });

  it("denies utility and external Type B URLs", async () => {
    findDecisionByIdMock.mockResolvedValue({
      ...typeB,
      pageUrl: "https://www.dbhobby.com/login",
    });
    await expect(
      requestPageAnalysis({
        websiteId: WEBSITE_ID,
        sessionToken: "owner-token",
        decisionId: "decision-1",
      }),
    ).rejects.toBeInstanceOf(AnalysisRequestError);

    findDecisionByIdMock.mockResolvedValue({
      ...typeB,
      pageUrl: "https://other.com/es/pintura-seda/set-de-cianotipo",
    });
    await expect(
      requestPageAnalysis({
        websiteId: WEBSITE_ID,
        sessionToken: "owner-token",
        decisionId: "decision-1",
      }),
    ).rejects.toMatchObject({ code: "invalid_url" });
  });

  it("blocks when an incompatible scan is already running", async () => {
    findActiveCrawlRunForWebsiteMock.mockResolvedValue({
      id: "active-crawl",
      seedUrl: "https://dbhobby.com/",
      status: "running",
    });
    listQueueItemsMock.mockResolvedValue([{ url: "https://dbhobby.com/" }]);
    listFetchedPagesForCrawlRunMock.mockResolvedValue([]);

    const view = await requestPageAnalysis({
      websiteId: WEBSITE_ID,
      sessionToken: "owner-token",
      decisionId: "decision-1",
    });

    expect(createAndEnqueueCrawlMock).not.toHaveBeenCalled();
    expect(view.status).toBe("blocked");
    expect(view.failureReason).toBe("scan_already_running");
    expect(view.crawlRunId).toBeNull();
  });

  it("reuses a compatible active crawl that already queued the URL", async () => {
    findActiveCrawlRunForWebsiteMock.mockResolvedValue({
      id: "active-crawl",
      seedUrl: "https://dbhobby.com/",
      status: "running",
    });
    listQueueItemsMock.mockResolvedValue([
      { url: "https://dbhobby.com/" },
      { url: REQUIRED },
    ]);

    const view = await requestPageAnalysis({
      websiteId: WEBSITE_ID,
      sessionToken: "owner-token",
      decisionId: "decision-1",
    });

    expect(createAndEnqueueCrawlMock).not.toHaveBeenCalled();
    expect(view.status).toBe("running");
    expect(view.crawlRunId).toBe("active-crawl");
  });

  it("does not generate Decisions or write ACT rows", async () => {
    await requestPageAnalysis({
      websiteId: WEBSITE_ID,
      sessionToken: "owner-token",
      decisionId: "decision-1",
    });

    expect(JSON.stringify(createAndEnqueueCrawlMock.mock.calls)).not.toMatch(/actions|verify|learn/i);
  });

  it("does not bypass the daily crawl ceiling when starting a required crawl", async () => {
    createAndEnqueueCrawlMock.mockRejectedValue(new DailyCrawlLimitReachedError());

    await expect(
      requestPageAnalysis({
        websiteId: WEBSITE_ID,
        sessionToken: "owner-token",
        decisionId: "decision-1",
      }),
    ).rejects.toBeInstanceOf(DailyCrawlLimitReachedError);
    expect(insertAnalysisRequestMock).not.toHaveBeenCalled();
  });

  it("denies a wrong owner", async () => {
    requireObserveOwnerMock.mockRejectedValue(new ObserveAuthError(403, "Not authorized."));

    await expect(
      requestPageAnalysis({
        websiteId: WEBSITE_ID,
        sessionToken: "other-token",
        decisionId: "decision-1",
      }),
    ).rejects.toBeInstanceOf(ObserveAuthError);
    expect(createAndEnqueueCrawlMock).not.toHaveBeenCalled();
  });

  it("maps a missing Google connection to missing GSC evidence", async () => {
    loadDecisionPrerequisitesMock.mockRejectedValue(
      new DecisionPrerequisiteError("google_not_connected", "Connect Google Search."),
    );

    await expect(
      requestPageAnalysis({
        websiteId: WEBSITE_ID,
        sessionToken: "owner-token",
        decisionId: "decision-1",
      }),
    ).rejects.toMatchObject({ code: "missing_gsc_evidence" });
  });
});

describe("listAnalysisRequestsForOwner", () => {
  it("requires an owner session", async () => {
    requireObserveOwnerMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    await expect(
      listAnalysisRequestsForOwner({ websiteId: WEBSITE_ID, sessionToken: null }),
    ).rejects.toBeInstanceOf(ObserveAuthError);
  });
});
