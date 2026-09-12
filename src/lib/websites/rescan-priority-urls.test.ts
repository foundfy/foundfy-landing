import { beforeEach, describe, expect, it, vi } from "vitest";

const findLatestUsableCrawlRunMock = vi.fn();
const listObservationsMock = vi.fn();

vi.mock("./repository", () => ({
  findLatestUsableCrawlRun: (...args: unknown[]) =>
    findLatestUsableCrawlRunMock(...args),
}));

vi.mock("@/lib/observations/db/repository", () => ({
  listObservations: (...args: unknown[]) => listObservationsMock(...args),
}));

import { resolveRescanPriorityUrls } from "./rescan-priority-urls";

const website = {
  id: "website-1",
  hostname: "example.com",
  displayUrl: "https://example.com/",
  firstSeenAt: "2026-09-10T00:00:00.000Z",
  lastCrawledAt: "2026-09-11T00:00:00.000Z",
};

describe("resolveRescanPriorityUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns previous finding pages except the seed", async () => {
    findLatestUsableCrawlRunMock.mockResolvedValue({ id: "prev-run" });
    listObservationsMock.mockResolvedValue([
      {
        ruleKey: "page_fundamentals.duplicate_title",
        pageUrl: "https://example.com/about",
        evidence: { finalUrl: "https://example.com/about" },
      },
      {
        ruleKey: "indexability.noindex",
        pageUrl: "https://example.com/",
        evidence: {},
      },
    ]);

    await expect(
      resolveRescanPriorityUrls(website, "https://example.com/"),
    ).resolves.toEqual(["https://example.com/about"]);
  });

  it("returns an empty list when there is no previous usable crawl", async () => {
    findLatestUsableCrawlRunMock.mockResolvedValue(null);

    await expect(
      resolveRescanPriorityUrls(website, "https://example.com/"),
    ).resolves.toEqual([]);
    expect(listObservationsMock).not.toHaveBeenCalled();
  });

  it("fails open when previous observations cannot be loaded", async () => {
    findLatestUsableCrawlRunMock.mockResolvedValue({ id: "prev-run" });
    listObservationsMock.mockRejectedValue(new Error("db down"));

    await expect(
      resolveRescanPriorityUrls(website, "https://example.com/"),
    ).resolves.toEqual([]);
  });
});
