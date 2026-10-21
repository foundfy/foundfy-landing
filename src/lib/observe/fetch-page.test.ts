import { beforeEach, describe, expect, it, vi } from "vitest";

const loadSourceRobotsArtifact = vi.fn();
const targetedObserveFetch = vi.fn();
const parseHtmlPage = vi.fn();
const saveParsedPage = vi.fn();

vi.mock("./db", () => ({
  loadSourceRobotsArtifact: (...args: unknown[]) => loadSourceRobotsArtifact(...args),
}));
vi.mock("@/lib/crawler/security/targeted-observe-fetch", () => ({
  targetedObserveFetch: (...args: unknown[]) => targetedObserveFetch(...args),
  SsrfValidationError: class SsrfValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "SsrfValidationError";
    }
  },
}));
vi.mock("@/lib/crawler/parse/page", () => ({
  parseHtmlPage: (...args: unknown[]) => parseHtmlPage(...args),
}));
vi.mock("@/lib/crawler/db/repository", () => ({
  saveParsedPage: (...args: unknown[]) => saveParsedPage(...args),
}));

import { SsrfValidationError } from "@/lib/crawler/security/targeted-observe-fetch";
import { fetchAndSaveTargetedPage, TargetedObserveFetchError } from "./fetch-page";

describe("fetchAndSaveTargetedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-checks persisted robots and does not fetch when ineligible", async () => {
    loadSourceRobotsArtifact.mockResolvedValue({
      statusCode: 200,
      content: "User-agent: *\nDisallow: /",
      parsed: { allow: [], disallow: ["/"], sitemaps: [] },
    });

    await expect(
      fetchAndSaveTargetedPage({
        websiteId: "site-1",
        hostname: "example.com",
        sourceCrawlRunId: "crawl-1",
        targetedCrawlRunId: "t-crawl-1",
        requestedUrl: "https://example.com/es/pintar-en-seda",
        startedAt: "2026-10-20T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ reason: "robots_disallow" });
    expect(targetedObserveFetch).not.toHaveBeenCalled();
  });

  it("saves exactly one page under the targeted crawl on HTML success", async () => {
    loadSourceRobotsArtifact.mockResolvedValue({
      statusCode: 404,
      content: "",
      parsed: { allow: [], disallow: [], sitemaps: [] },
    });
    targetedObserveFetch.mockResolvedValue({
      requestedUrl: "https://example.com/es/pintar-en-seda",
      finalUrl: "https://example.com/es/pintar-en-seda",
      statusCode: 200,
      redirectChain: [],
      headers: { "content-type": "text/html" },
      body: "<html><title>ok</title></html>",
    });
    parseHtmlPage.mockReturnValue({ title: "ok" });
    saveParsedPage.mockResolvedValue("page-1");

    await expect(
      fetchAndSaveTargetedPage({
        websiteId: "site-1",
        hostname: "example.com",
        sourceCrawlRunId: "crawl-1",
        targetedCrawlRunId: "t-crawl-1",
        requestedUrl: "https://example.com/es/pintar-en-seda",
        startedAt: "2026-10-20T00:00:00.000Z",
      }),
    ).resolves.toBe("page-1");
    expect(targetedObserveFetch).toHaveBeenCalledTimes(1);
    expect(targetedObserveFetch).toHaveBeenCalledWith(
      "https://example.com/es/pintar-en-seda",
      "example.com",
      { startedAt: "2026-10-20T00:00:00.000Z" },
    );
    expect(saveParsedPage).toHaveBeenCalledWith({
      crawlRunId: "t-crawl-1",
      websiteId: "site-1",
      parsed: { title: "ok" },
    });
  });

  it("maps timeout and non-HTML to bounded fetch errors", async () => {
    loadSourceRobotsArtifact.mockResolvedValue({
      statusCode: 404,
      content: "",
      parsed: { allow: [], disallow: [], sitemaps: [] },
    });
    targetedObserveFetch.mockRejectedValueOnce(new SsrfValidationError("Request timed out."));

    await expect(
      fetchAndSaveTargetedPage({
        websiteId: "site-1",
        hostname: "example.com",
        sourceCrawlRunId: "crawl-1",
        targetedCrawlRunId: "t-crawl-1",
        requestedUrl: "https://example.com/es/pintar-en-seda",
        startedAt: "2026-10-20T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(TargetedObserveFetchError);

    targetedObserveFetch.mockResolvedValueOnce({
      requestedUrl: "https://example.com/es/pintar-en-seda",
      finalUrl: "https://example.com/es/pintar-en-seda",
      statusCode: 200,
      redirectChain: [],
      headers: { "content-type": "application/pdf" },
      body: "%PDF",
    });
    await expect(
      fetchAndSaveTargetedPage({
        websiteId: "site-1",
        hostname: "example.com",
        sourceCrawlRunId: "crawl-1",
        targetedCrawlRunId: "t-crawl-1",
        requestedUrl: "https://example.com/es/pintar-en-seda",
        startedAt: "2026-10-20T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ reason: "non_html" });
  });
});
