import { beforeEach, describe, expect, it, vi } from "vitest";

const areObservationsMaterializedMock = vi.fn();
const countActiveObservationsMock = vi.fn();
const generateObservationsForCrawlRunMock = vi.fn();

vi.mock("@/lib/observations/db/repository", () => ({
  areObservationsMaterialized: (...args: unknown[]) =>
    areObservationsMaterializedMock(...args),
  countActiveObservations: (...args: unknown[]) => countActiveObservationsMock(...args),
  generateObservationsForCrawlRun: (...args: unknown[]) =>
    generateObservationsForCrawlRunMock(...args),
}));

import { loadTrustworthyFindingsCount } from "./findings-count";

describe("loadTrustworthyFindingsCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for non-usable runs", async () => {
    await expect(
      loadTrustworthyFindingsCount({
        crawlRunId: "run-1",
        status: "failed",
        pagesCrawled: 0,
      }),
    ).resolves.toBeNull();

    expect(areObservationsMaterializedMock).not.toHaveBeenCalled();
  });

  it("materializes legacy runs before counting", async () => {
    areObservationsMaterializedMock.mockResolvedValue(false);
    countActiveObservationsMock.mockResolvedValue(22);
    generateObservationsForCrawlRunMock.mockResolvedValue({
      crawlRunId: "run-1",
      generatedCount: 22,
      observations: [],
    });

    await expect(
      loadTrustworthyFindingsCount({
        crawlRunId: "run-1",
        status: "completed",
        pagesCrawled: 10,
      }),
    ).resolves.toBe(22);

    expect(generateObservationsForCrawlRunMock).toHaveBeenCalledWith("run-1");
  });

  it("does not regenerate when observations are already materialized", async () => {
    areObservationsMaterializedMock.mockResolvedValue(true);
    countActiveObservationsMock.mockResolvedValue(0);

    await expect(
      loadTrustworthyFindingsCount({
        crawlRunId: "run-1",
        status: "completed",
        pagesCrawled: 10,
      }),
    ).resolves.toBe(0);

    expect(generateObservationsForCrawlRunMock).not.toHaveBeenCalled();
  });

  it("normalizes legacy zero-page completed runs to null findings count", async () => {
    await expect(
      loadTrustworthyFindingsCount({
        crawlRunId: "run-legacy",
        status: "completed",
        pagesCrawled: 0,
      }),
    ).resolves.toBeNull();
  });
});
