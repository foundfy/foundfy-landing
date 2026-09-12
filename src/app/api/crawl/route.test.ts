import { afterEach, describe, expect, it, vi } from "vitest";

const upsertWebsiteMock = vi.fn();
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

vi.mock("@/lib/crawler/db/repository", () => ({
  upsertWebsite: (...args: unknown[]) => upsertWebsiteMock(...args),
}));

vi.mock("@/lib/crawler/start-crawl", () => ({
  createAndEnqueueCrawl: (...args: unknown[]) => createAndEnqueueCrawlMock(...args),
}));

vi.mock("@/lib/crawler/worker/process-run", () => ({
  processCrawlRun: (...args: unknown[]) => processCrawlRunMock(...args),
}));

import { DailyCrawlLimitReachedError } from "@/lib/crawler/daily-crawl-limit";
import { POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
  processCrawlRunMock.mockResolvedValue("run-1");
});

describe("POST /api/crawl", () => {
  it("returns crawlRunId and websiteId", async () => {
    upsertWebsiteMock.mockResolvedValue({
      id: "website-1",
      url: "https://www.ekoiq.com/",
      hostname: "ekoiq.com",
    });
    createAndEnqueueCrawlMock.mockResolvedValue({
      crawlRunId: "run-1",
      websiteId: "website-1",
    });

    const response = await POST(
      new Request("https://example.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "www.ekoiq.com" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({
      crawlRunId: "run-1",
      websiteId: "website-1",
    });
    expect(upsertWebsiteMock).toHaveBeenCalledWith(
      "https://www.ekoiq.com/",
      "ekoiq.com",
    );
    expect(afterMock).not.toHaveBeenCalled();
    expect(processCrawlRunMock).not.toHaveBeenCalled();
  });

  it("respects the daily crawl guardrail without creating a crawl", async () => {
    upsertWebsiteMock.mockResolvedValue({
      id: "website-1",
      url: "https://www.ekoiq.com/",
      hostname: "ekoiq.com",
    });
    createAndEnqueueCrawlMock.mockRejectedValue(new DailyCrawlLimitReachedError());

    const response = await POST(
      new Request("https://example.test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "www.ekoiq.com" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload).toEqual({
      error: "Foundfy has reached today's beta analysis limit. Try again tomorrow.",
    });
    expect(createAndEnqueueCrawlMock).toHaveBeenCalledTimes(1);
  });
});
