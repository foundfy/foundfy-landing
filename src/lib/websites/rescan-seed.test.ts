import { beforeEach, describe, expect, it, vi } from "vitest";

const findLatestUsableCrawlRunMock = vi.fn();

vi.mock("./repository", () => ({
  findLatestUsableCrawlRun: (...args: unknown[]) => findLatestUsableCrawlRunMock(...args),
}));

import { resolveRescanSeedUrl } from "./rescan-seed";

const website = {
  id: "website-1",
  hostname: "ekoiq.com",
  displayUrl: "https://www.ekoiq.com/",
  firstSeenAt: "2026-09-10T00:00:00.000Z",
  lastCrawledAt: "2026-09-11T00:00:00.000Z",
};

describe("resolveRescanSeedUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers the latest usable completed crawl seed", async () => {
    findLatestUsableCrawlRunMock.mockResolvedValue({
      id: "run-success",
      websiteId: website.id,
      status: "completed",
      seedUrl: "https://www.ekoiq.com/",
      pagesCrawled: 10,
      maxPages: 10,
      errorMessage: null,
      startedAt: "2026-09-10T15:00:00.000Z",
      completedAt: "2026-09-10T15:01:00.000Z",
      createdAt: "2026-09-10T14:59:59.000Z",
    });

    await expect(resolveRescanSeedUrl(website)).resolves.toBe("https://www.ekoiq.com/");
  });

  it("falls back to website display URL when no usable crawl exists", async () => {
    findLatestUsableCrawlRunMock.mockResolvedValue(null);

    await expect(resolveRescanSeedUrl(website)).resolves.toBe("https://www.ekoiq.com/");
  });

  it("falls back to origin when no usable crawl or display URL exists", async () => {
    findLatestUsableCrawlRunMock.mockResolvedValue(null);

    await expect(
      resolveRescanSeedUrl({
        ...website,
        displayUrl: "",
      }),
    ).resolves.toBe("https://ekoiq.com");
  });
});
