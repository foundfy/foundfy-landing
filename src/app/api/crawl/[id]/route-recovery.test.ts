import { afterEach, describe, expect, it, vi } from "vitest";

const getCrawlRunSummaryMock = vi.fn();
const maybeRecoverStaleCrawlRunMock = vi.fn();
const processCrawlRunMock = vi.fn();
const loadCompletedCrawlResultsMock = vi.fn();
const scheduleExplanationEnrichmentIfNeededMock = vi.fn();
const afterMock = vi.fn((callback: () => Promise<void>) => {
  void callback();
});

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (callback: () => Promise<void>) => afterMock(callback),
  };
});

vi.mock("@/lib/crawler/db/repository", () => ({
  getCrawlRunSummary: (...args: unknown[]) => getCrawlRunSummaryMock(...args),
}));

vi.mock("@/lib/crawler/worker/recover-stale-run", () => ({
  maybeRecoverStaleCrawlRun: (...args: unknown[]) => maybeRecoverStaleCrawlRunMock(...args),
}));

vi.mock("@/lib/crawler/worker/process-run", () => ({
  processCrawlRun: (...args: unknown[]) => processCrawlRunMock(...args),
}));

vi.mock("@/lib/findings/load-completed-results", () => ({
  loadCompletedCrawlResults: (...args: unknown[]) => loadCompletedCrawlResultsMock(...args),
}));

vi.mock("@/lib/ai-enrichment/scheduler", () => ({
  scheduleExplanationEnrichmentIfNeeded: (...args: unknown[]) =>
    scheduleExplanationEnrichmentIfNeededMock(...args),
}));

import { GET } from "./route";

const RUN_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

afterEach(() => {
  getCrawlRunSummaryMock.mockReset();
  maybeRecoverStaleCrawlRunMock.mockReset();
  processCrawlRunMock.mockReset();
  loadCompletedCrawlResultsMock.mockReset();
  scheduleExplanationEnrichmentIfNeededMock.mockReset();
  afterMock.mockClear();
  processCrawlRunMock.mockResolvedValue(RUN_ID);
});

describe("GET /api/crawl/[id] recovery integration", () => {
  it("re-kicks the worker after stale running recovery without scheduling AI enrichment", async () => {
    getCrawlRunSummaryMock
      .mockResolvedValueOnce({
        id: RUN_ID,
        status: "running",
        hostname: "arngren.net",
        seedUrl: "https://www.arngren.net/",
        maxPages: 10,
        pagesCrawled: 1,
        pagesDiscovered: 123,
        errorMessage: null,
        startedAt: "2026-09-10T15:00:00.000Z",
        completedAt: null,
        createdAt: "2026-09-10T14:59:59.000Z",
      })
      .mockResolvedValueOnce({
        id: RUN_ID,
        status: "queued",
        hostname: "arngren.net",
        seedUrl: "https://www.arngren.net/",
        maxPages: 10,
        pagesCrawled: 1,
        pagesDiscovered: 123,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: "2026-09-10T14:59:59.000Z",
      });

    maybeRecoverStaleCrawlRunMock.mockResolvedValue({ recovered: true });

    const response = await GET(new Request("https://example.test"), {
      params: Promise.resolve({ id: RUN_ID }),
    });
    const payload = await response.json();

    expect(payload.status).toBe("queued");
    expect(maybeRecoverStaleCrawlRunMock).toHaveBeenCalledWith(RUN_ID);
    expect(processCrawlRunMock).toHaveBeenCalledWith(RUN_ID);
    expect(loadCompletedCrawlResultsMock).not.toHaveBeenCalled();
    expect(scheduleExplanationEnrichmentIfNeededMock).not.toHaveBeenCalled();
  });

  it("schedules AI enrichment only after deterministic completion", async () => {
    getCrawlRunSummaryMock.mockResolvedValue({
      id: RUN_ID,
      status: "completed",
      hostname: "arngren.net",
      seedUrl: "https://www.arngren.net/",
      maxPages: 10,
      pagesCrawled: 10,
      pagesDiscovered: 123,
      errorMessage: null,
      startedAt: "2026-09-10T15:00:00.000Z",
      completedAt: "2026-09-10T15:01:00.000Z",
      createdAt: "2026-09-10T14:59:59.000Z",
    });
    maybeRecoverStaleCrawlRunMock.mockResolvedValue({ recovered: false });
    loadCompletedCrawlResultsMock.mockResolvedValue({
      findings: [{ id: "finding-1" }],
      findingsSummary: { totalCount: 1, highlightedFindingIds: ["finding-1"] },
      explanationEnrichmentStatus: "pending",
    });

    await GET(new Request("https://example.test"), {
      params: Promise.resolve({ id: RUN_ID }),
    });

    expect(maybeRecoverStaleCrawlRunMock).toHaveBeenCalledWith(RUN_ID);
    expect(processCrawlRunMock).not.toHaveBeenCalled();
    expect(scheduleExplanationEnrichmentIfNeededMock).toHaveBeenCalledWith(
      expect.objectContaining({ crawlRunId: RUN_ID }),
    );
  });

  it("preserves existing queued recovery behavior", async () => {
    getCrawlRunSummaryMock.mockResolvedValue({
      id: RUN_ID,
      status: "queued",
      hostname: "arngren.net",
      seedUrl: "https://www.arngren.net/",
      maxPages: 10,
      pagesCrawled: 0,
      pagesDiscovered: 1,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: "2026-09-10T14:59:59.000Z",
    });
    maybeRecoverStaleCrawlRunMock.mockResolvedValue({ recovered: false });

    await GET(new Request("https://example.test"), {
      params: Promise.resolve({ id: RUN_ID }),
    });

    expect(processCrawlRunMock).toHaveBeenCalledWith(RUN_ID);
    expect(scheduleExplanationEnrichmentIfNeededMock).not.toHaveBeenCalled();
  });
});
