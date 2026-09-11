import { afterEach, describe, expect, it, vi } from "vitest";

const getWebsiteByIdMock = vi.fn();
const findActiveCrawlRunForWebsiteMock = vi.fn();
const resolveRescanSeedUrlMock = vi.fn();
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

vi.mock("@/lib/crawler/start-crawl", () => ({
  createAndEnqueueCrawl: (...args: unknown[]) => createAndEnqueueCrawlMock(...args),
}));

vi.mock("@/lib/crawler/worker/process-run", () => ({
  processCrawlRun: (...args: unknown[]) => processCrawlRunMock(...args),
}));

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

  it("creates a new crawl run when no active scan exists", async () => {
    getWebsiteByIdMock.mockResolvedValue(website);
    findActiveCrawlRunForWebsiteMock.mockResolvedValue(null);
    resolveRescanSeedUrlMock.mockResolvedValue("https://www.ekoiq.com/");
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
    expect(createAndEnqueueCrawlMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      seedUrl: "https://www.ekoiq.com/",
    });
    expect(processCrawlRunMock).toHaveBeenCalledWith("new-run");
  });
});
