import { afterEach, describe, expect, it, vi } from "vitest";

const getWebsiteByIdMock = vi.fn();
const findActiveCrawlRunForWebsiteMock = vi.fn();
const resolveRescanSeedUrlMock = vi.fn();
const resolveRescanPriorityUrlsMock = vi.fn();
const resolveOwnerGscVisibilityPagesMock = vi.fn(async () => []);
const createAndEnqueueCrawlMock = vi.fn();
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

vi.mock("@/lib/websites/repository", () => ({
  getWebsiteById: (...args: unknown[]) => getWebsiteByIdMock(...args),
  findActiveCrawlRunForWebsite: (...args: unknown[]) =>
    findActiveCrawlRunForWebsiteMock(...args),
}));

vi.mock("@/lib/websites/rescan-seed", () => ({
  resolveRescanSeedUrl: (...args: unknown[]) => resolveRescanSeedUrlMock(...args),
}));

vi.mock("@/lib/websites/rescan-priority-urls", () => ({
  resolveRescanPriorityUrls: (...args: unknown[]) =>
    resolveRescanPriorityUrlsMock(...args),
}));

vi.mock("@/lib/crawler/select/gsc-visibility", () => ({
  resolveOwnerGscVisibilityPages: (...args: unknown[]) =>
    resolveOwnerGscVisibilityPagesMock(...args),
}));

vi.mock("@/lib/crawler/start-crawl", () => ({
  createAndEnqueueCrawl: (...args: unknown[]) => createAndEnqueueCrawlMock(...args),
}));

vi.mock("@/lib/crawler/worker/process-run", () => ({
  processCrawlRun: (...args: unknown[]) => processCrawlRunMock(...args),
}));

import { DailyCrawlLimitReachedError } from "@/lib/crawler/daily-crawl-limit";
import { POST } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

const website = {
  id: WEBSITE_ID,
  hostname: "ekoiq.com",
  displayUrl: "https://www.ekoiq.com/",
  firstSeenAt: "2026-09-10T00:00:00.000Z",
  lastCrawledAt: "2026-09-11T00:00:00.000Z",
};

afterEach(() => {
  vi.clearAllMocks();
  processCrawlRunMock.mockResolvedValue("new-run");
  resolveOwnerGscVisibilityPagesMock.mockResolvedValue([]);
});

describe("POST /api/websites/[websiteId]/scan", () => {
  it("returns an existing active scan instead of creating a duplicate", async () => {
    getWebsiteByIdMock.mockResolvedValue(website);
    findActiveCrawlRunForWebsiteMock.mockResolvedValue({
      id: "active-run",
      websiteId: WEBSITE_ID,
      status: "running",
      seedUrl: "https://www.ekoiq.com/",
      pagesCrawled: 2,
      maxPages: 10,
      errorMessage: null,
      startedAt: "2026-09-11T15:00:00.000Z",
      completedAt: null,
      createdAt: "2026-09-11T14:59:59.000Z",
    });

    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      crawlRunId: "active-run",
      websiteId: WEBSITE_ID,
      reusedActiveScan: true,
    });
    expect(createAndEnqueueCrawlMock).not.toHaveBeenCalled();
    expect(processCrawlRunMock).not.toHaveBeenCalled();
  });

  it("reuses an active scan without consuming a daily crawl slot", async () => {
    getWebsiteByIdMock.mockResolvedValue(website);
    findActiveCrawlRunForWebsiteMock.mockResolvedValue({
      id: "active-run",
      websiteId: WEBSITE_ID,
      status: "queued",
      seedUrl: "https://www.ekoiq.com/",
      pagesCrawled: 0,
      maxPages: 10,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: "2026-09-11T14:59:59.000Z",
    });

    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });

    expect(response.status).toBe(200);
    expect(createAndEnqueueCrawlMock).not.toHaveBeenCalled();
  });

  it("creates a new crawl run when no active scan exists", async () => {
    getWebsiteByIdMock.mockResolvedValue(website);
    findActiveCrawlRunForWebsiteMock.mockResolvedValue(null);
    resolveRescanSeedUrlMock.mockResolvedValue("https://www.ekoiq.com/");
    resolveRescanPriorityUrlsMock.mockResolvedValue([
      "https://www.ekoiq.com/hakkimizda",
    ]);
    createAndEnqueueCrawlMock.mockResolvedValue({
      crawlRunId: "new-run",
      websiteId: WEBSITE_ID,
    });

    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({
      crawlRunId: "new-run",
      websiteId: WEBSITE_ID,
      reusedActiveScan: false,
    });
    expect(resolveRescanPriorityUrlsMock).toHaveBeenCalledWith(
      website,
      "https://www.ekoiq.com/",
    );
    expect(createAndEnqueueCrawlMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      seedUrl: "https://www.ekoiq.com/",
      priorityUrls: ["https://www.ekoiq.com/hakkimizda"],
    });
    expect(afterMock).not.toHaveBeenCalled();
    expect(processCrawlRunMock).not.toHaveBeenCalled();
  });

  it("respects the daily crawl guardrail on a new rescan without breaking reuse", async () => {
    getWebsiteByIdMock.mockResolvedValue(website);
    findActiveCrawlRunForWebsiteMock.mockResolvedValue(null);
    resolveRescanSeedUrlMock.mockResolvedValue("https://www.ekoiq.com/");
    resolveRescanPriorityUrlsMock.mockResolvedValue([]);
    createAndEnqueueCrawlMock.mockRejectedValue(new DailyCrawlLimitReachedError());

    const response = await POST(new Request("https://example.test"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload).toEqual({
      error: "Foundfy has reached today's beta analysis limit. Try again tomorrow.",
    });
    expect(createAndEnqueueCrawlMock).toHaveBeenCalledTimes(1);
    expect(findActiveCrawlRunForWebsiteMock).toHaveBeenCalledWith(WEBSITE_ID);
  });

  it("does not pass private GSC URLs on a public/non-owner rescan", async () => {
    getWebsiteByIdMock.mockResolvedValue(website);
    findActiveCrawlRunForWebsiteMock.mockResolvedValue(null);
    resolveRescanSeedUrlMock.mockResolvedValue("https://www.ekoiq.com/");
    resolveRescanPriorityUrlsMock.mockResolvedValue([]);
    createAndEnqueueCrawlMock.mockResolvedValue({
      crawlRunId: "new-run",
      websiteId: WEBSITE_ID,
    });

    await POST(new Request("https://example.test"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });

    expect(resolveOwnerGscVisibilityPagesMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      hostname: "ekoiq.com",
      sessionToken: null,
    });
    expect(createAndEnqueueCrawlMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      seedUrl: "https://www.ekoiq.com/",
      priorityUrls: [],
    });
    expect(createAndEnqueueCrawlMock.mock.calls[0]?.[0]).not.toHaveProperty("gscVisibilityUrls");
  });

  it("passes current private GSC URLs on an owner-authorized rescan", async () => {
    getWebsiteByIdMock.mockResolvedValue(website);
    findActiveCrawlRunForWebsiteMock.mockResolvedValue(null);
    resolveRescanSeedUrlMock.mockResolvedValue("https://www.ekoiq.com/");
    resolveRescanPriorityUrlsMock.mockResolvedValue([]);
    resolveOwnerGscVisibilityPagesMock.mockResolvedValue([
      { url: "https://www.ekoiq.com/dergi", impressions: 80, clicks: 4 },
    ]);
    createAndEnqueueCrawlMock.mockResolvedValue({
      crawlRunId: "new-run",
      websiteId: WEBSITE_ID,
    });

    await POST(
      new Request("https://example.test", {
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(resolveOwnerGscVisibilityPagesMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      hostname: "ekoiq.com",
      sessionToken: "owner-token",
    });
    expect(createAndEnqueueCrawlMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      seedUrl: "https://www.ekoiq.com/",
      priorityUrls: [],
      gscVisibilityUrls: ["https://www.ekoiq.com/dergi"],
    });
  });
});
