import { beforeEach, describe, expect, it, vi } from "vitest";

const getCrawlRunSummaryMock = vi.fn();
const listOpenAnalysisRequestsForCrawlRunMock = vi.fn();
const listFetchedPagesForCrawlRunMock = vi.fn();
const updateActiveAnalysisRequestMock = vi.fn();
const findAnalysisRequestByIdMock = vi.fn();

vi.mock("@/lib/crawler/db/repository", () => ({
  getCrawlRunSummary: (...args: unknown[]) => getCrawlRunSummaryMock(...args),
}));

vi.mock("./db", () => ({
  listOpenAnalysisRequestsForCrawlRun: (...args: unknown[]) =>
    listOpenAnalysisRequestsForCrawlRunMock(...args),
  listFetchedPagesForCrawlRun: (...args: unknown[]) => listFetchedPagesForCrawlRunMock(...args),
  updateActiveAnalysisRequest: (...args: unknown[]) => updateActiveAnalysisRequestMock(...args),
  findAnalysisRequestById: (...args: unknown[]) => findAnalysisRequestByIdMock(...args),
}));

import { settleAnalysisRequest, settleAnalysisRequestsForCrawlRun } from "./settle";
import type { AnalysisRequestRecord } from "./types";

const request: AnalysisRequestRecord = {
  id: "req-1",
  websiteId: "website-1",
  decisionId: "decision-1",
  decisionRunId: "drun-1",
  gscSyncId: "sync-1",
  requestedUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
  requestedUrlKey: "https://dbhobby.com/es/pintura-seda/set-de-cianotipo",
  requestedBy: "owner-1",
  requestedAt: "2026-10-09T00:00:00.000Z",
  crawlRunId: "crawl-1",
  resultPageId: null,
  status: "running",
  failureReason: null,
  createdAt: "2026-10-09T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
};

describe("settleAnalysisRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateActiveAnalysisRequestMock.mockImplementation(async (_id: string, patch: object) => ({
      ...request,
      ...patch,
    }));
  });

  it("marks analyzed when the requested URL was fetched", async () => {
    getCrawlRunSummaryMock.mockResolvedValue({
      status: "completed",
      pagesCrawled: 10,
      errorMessage: null,
    });
    listFetchedPagesForCrawlRunMock.mockResolvedValue([
      {
        id: "page-1",
        requestedUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
        finalUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
      },
    ]);

    await settleAnalysisRequest(request);

    expect(updateActiveAnalysisRequestMock).toHaveBeenCalledWith("req-1", {
      status: "analyzed",
      resultPageId: "page-1",
      failureReason: null,
    });
  });

  it("marks analyzed when the fetched page is an HTTP error with stored evidence", async () => {
    getCrawlRunSummaryMock.mockResolvedValue({
      status: "completed",
      pagesCrawled: 10,
      errorMessage: null,
    });
    listFetchedPagesForCrawlRunMock.mockResolvedValue([
      {
        id: "page-404",
        requestedUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
        finalUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
        statusCode: 404,
      },
    ]);

    const settled = await settleAnalysisRequest(request);

    expect(settled.status).toBe("analyzed");
    expect(updateActiveAnalysisRequestMock).toHaveBeenCalledWith("req-1", {
      status: "analyzed",
      resultPageId: "page-404",
      failureReason: null,
    });
  });

  it("marks fetch_failed when the crawl completed without usable page evidence", async () => {
    getCrawlRunSummaryMock.mockResolvedValue({
      status: "completed",
      pagesCrawled: 10,
      errorMessage: null,
    });
    listFetchedPagesForCrawlRunMock.mockResolvedValue([
      {
        id: "page-home",
        requestedUrl: "https://dbhobby.com/",
        finalUrl: "https://dbhobby.com/",
      },
    ]);

    await settleAnalysisRequest(request);

    expect(updateActiveAnalysisRequestMock).toHaveBeenCalledWith("req-1", {
      status: "fetch_failed",
      failureReason: "Foundfy couldn't read this page.",
    });
  });

  it("does not reopen a request blocked by Google disconnect", async () => {
    const blocked: AnalysisRequestRecord = {
      ...request,
      status: "blocked",
      failureReason: "google_disconnected",
    };

    const settled = await settleAnalysisRequest(blocked);

    expect(settled.status).toBe("blocked");
    expect(getCrawlRunSummaryMock).not.toHaveBeenCalled();
    expect(updateActiveAnalysisRequestMock).not.toHaveBeenCalled();
  });

  it("keeps a disconnect-blocked request blocked if settle loses the race", async () => {
    getCrawlRunSummaryMock.mockResolvedValue({
      status: "completed",
      pagesCrawled: 10,
      errorMessage: null,
    });
    listFetchedPagesForCrawlRunMock.mockResolvedValue([
      {
        id: "page-1",
        requestedUrl: request.requestedUrl,
        finalUrl: request.requestedUrl,
      },
    ]);
    updateActiveAnalysisRequestMock.mockResolvedValue(null);
    findAnalysisRequestByIdMock.mockResolvedValue({
      ...request,
      status: "blocked",
      failureReason: "google_disconnected",
    });

    const settled = await settleAnalysisRequest(request);

    expect(settled.status).toBe("blocked");
    expect(settled.failureReason).toBe("google_disconnected");
  });

  it("settles open requests for a crawl run", async () => {
    listOpenAnalysisRequestsForCrawlRunMock.mockResolvedValue([request]);
    getCrawlRunSummaryMock.mockResolvedValue({
      status: "failed",
      pagesCrawled: 0,
      errorMessage: "We couldn't successfully crawl any pages from this website.",
    });

    await settleAnalysisRequestsForCrawlRun("crawl-1");

    expect(updateActiveAnalysisRequestMock).toHaveBeenCalledWith("req-1", {
      status: "fetch_failed",
      failureReason: "We couldn't successfully crawl any pages from this website.",
    });
  });
});
