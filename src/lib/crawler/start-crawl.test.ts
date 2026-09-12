import { beforeEach, describe, expect, it, vi } from "vitest";

const assertCanCreateNewCrawlMock = vi.fn();
const createCrawlRunMock = vi.fn();
const enqueueUrlMock = vi.fn();

vi.mock("./daily-crawl-limit", async () => {
  const actual = await vi.importActual<typeof import("./daily-crawl-limit")>(
    "./daily-crawl-limit",
  );

  return {
    ...actual,
    assertCanCreateNewCrawl: (...args: unknown[]) =>
      assertCanCreateNewCrawlMock(...args),
  };
});

vi.mock("./db/repository", () => ({
  createCrawlRun: (...args: unknown[]) => createCrawlRunMock(...args),
  enqueueUrl: (...args: unknown[]) => enqueueUrlMock(...args),
}));

import { DailyCrawlLimitReachedError } from "./daily-crawl-limit";
import { createAndEnqueueCrawl } from "./start-crawl";

describe("createAndEnqueueCrawl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createCrawlRunMock.mockResolvedValue({ id: "run-1" });
    enqueueUrlMock.mockResolvedValue(undefined);
  });

  it("creates a crawl after the daily ceiling still has room", async () => {
    assertCanCreateNewCrawlMock.mockResolvedValue(undefined);

    await expect(
      createAndEnqueueCrawl({
        websiteId: "website-1",
        seedUrl: "https://example.com/",
      }),
    ).resolves.toEqual({
      crawlRunId: "run-1",
      websiteId: "website-1",
    });

    expect(assertCanCreateNewCrawlMock).toHaveBeenCalledTimes(1);
    expect(createCrawlRunMock).toHaveBeenCalledTimes(1);
  });

  it("does not create a crawl when the daily ceiling is reached", async () => {
    assertCanCreateNewCrawlMock.mockRejectedValue(new DailyCrawlLimitReachedError());

    await expect(
      createAndEnqueueCrawl({
        websiteId: "website-1",
        seedUrl: "https://example.com/",
      }),
    ).rejects.toBeInstanceOf(DailyCrawlLimitReachedError);

    expect(createCrawlRunMock).not.toHaveBeenCalled();
    expect(enqueueUrlMock).not.toHaveBeenCalled();
  });
});
