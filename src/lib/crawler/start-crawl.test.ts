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
import { SEED_QUEUE_PRIORITY, VERIFICATION_QUEUE_PRIORITY } from "./select/page-priority";
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
    expect(enqueueUrlMock).toHaveBeenCalledTimes(1);
    expect(enqueueUrlMock).toHaveBeenCalledWith({
      crawlRunId: "run-1",
      url: "https://example.com/",
      depth: 0,
      priority: SEED_QUEUE_PRIORITY,
    });
  });

  it("enqueues previous finding URLs after the seed and below the 10-page budget", async () => {
    assertCanCreateNewCrawlMock.mockResolvedValue(undefined);
    const priorityUrls = Array.from({ length: 12 }, (_, index) => {
      return `https://example.com/page-${index + 1}`;
    });

    await createAndEnqueueCrawl({
      websiteId: "website-1",
      seedUrl: "https://example.com/",
      priorityUrls: ["https://example.com/", ...priorityUrls],
    });

    const enqueued = enqueueUrlMock.mock.calls.map(
      (call) => call[0] as { url: string; priority: number },
    );

    expect(enqueued).toHaveLength(10);
    expect(enqueued[0]).toEqual({
      crawlRunId: "run-1",
      url: "https://example.com/",
      depth: 0,
      priority: SEED_QUEUE_PRIORITY,
    });
    expect(enqueued.slice(1).every((item) => item.priority === VERIFICATION_QUEUE_PRIORITY)).toBe(
      true,
    );
    expect(enqueued.slice(1).map((item) => item.url)).toEqual(
      priorityUrls.slice(0, 9),
    );
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
