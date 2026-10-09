import { afterEach, describe, expect, it, vi } from "vitest";

const listAnalysisRequestsForOwnerMock = vi.fn();
const requestPageAnalysisMock = vi.fn();
const processCrawlRunMock = vi.fn();
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

vi.mock("@/lib/analysis-requests/request", () => ({
  listAnalysisRequestsForOwner: (...args: unknown[]) =>
    listAnalysisRequestsForOwnerMock(...args),
  requestPageAnalysis: (...args: unknown[]) => requestPageAnalysisMock(...args),
}));

vi.mock("@/lib/crawler/worker/process-run", () => ({
  processCrawlRun: (...args: unknown[]) => processCrawlRunMock(...args),
}));

import { DailyCrawlLimitReachedError } from "@/lib/crawler/daily-crawl-limit";
import { ObserveAuthError } from "@/lib/gsc/types";
import { GET, POST } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/websites/[websiteId]/analysis-requests", () => {
  it("requires an owner session", async () => {
    listAnalysisRequestsForOwnerMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    const response = await GET(new Request("https://www.foundfy.me/analysis-requests"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
  });

  it("returns private no-store analysis requests", async () => {
    listAnalysisRequestsForOwnerMock.mockResolvedValue({
      requests: [{ id: "req-1", status: "analyzed" }],
    });

    const response = await GET(
      new Request("https://www.foundfy.me/analysis-requests", {
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
    expect(await response.json()).toEqual({
      requests: [{ id: "req-1", status: "analyzed" }],
    });
  });
});

describe("POST /api/websites/[websiteId]/analysis-requests", () => {
  it("starts the worker for a newly requested crawl and does not generate Decisions", async () => {
    requestPageAnalysisMock.mockResolvedValue({
      id: "req-1",
      status: "requested",
      crawlRunId: "new-crawl",
    });

    const response = await POST(
      new Request("https://www.foundfy.me/analysis-requests", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
        body: JSON.stringify({ decisionId: WEBSITE_ID }),
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(201);
    expect(afterMock).toHaveBeenCalled();
    expect(processCrawlRunMock).toHaveBeenCalledWith("new-crawl");
    expect(requestPageAnalysisMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      sessionToken: "owner-token",
      decisionId: WEBSITE_ID,
    });
  });

  it("does not start a crawl worker for a blocked request", async () => {
    requestPageAnalysisMock.mockResolvedValue({
      id: "req-1",
      status: "blocked",
      crawlRunId: null,
      failureReason: "scan_already_running",
    });

    const response = await POST(
      new Request("https://www.foundfy.me/analysis-requests", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
        body: JSON.stringify({ decisionId: WEBSITE_ID }),
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(processCrawlRunMock).not.toHaveBeenCalled();
  });

  it("returns 429 when the daily crawl ceiling is reached", async () => {
    requestPageAnalysisMock.mockRejectedValue(new DailyCrawlLimitReachedError());

    const response = await POST(
      new Request("https://www.foundfy.me/analysis-requests", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
        body: JSON.stringify({ decisionId: WEBSITE_ID }),
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(429);
    expect(processCrawlRunMock).not.toHaveBeenCalled();
  });
});
