import { beforeEach, describe, expect, it, vi } from "vitest";

const getCrawlRunSummaryMock = vi.fn();
const listObservationsMock = vi.fn();
const generateObservationsForCrawlRunMock = vi.fn();
const listPrioritiesMock = vi.fn();
const generatePrioritiesForCrawlRunMock = vi.fn();

vi.mock("@/lib/crawler/db/repository", () => ({
  getCrawlRunSummary: (...args: unknown[]) => getCrawlRunSummaryMock(...args),
}));

vi.mock("@/lib/observations/db/repository", () => ({
  listObservations: (...args: unknown[]) => listObservationsMock(...args),
  generateObservationsForCrawlRun: (...args: unknown[]) =>
    generateObservationsForCrawlRunMock(...args),
}));

vi.mock("@/lib/priorities/db/repository", () => ({
  listPriorities: (...args: unknown[]) => listPrioritiesMock(...args),
  generatePrioritiesForCrawlRun: (...args: unknown[]) =>
    generatePrioritiesForCrawlRunMock(...args),
}));

import { loadFindingsForCompletedRun } from "./load-for-run";

describe("loadFindingsForCompletedRun purpose isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses findings materialization for targeted_observe crawls", async () => {
    getCrawlRunSummaryMock.mockResolvedValue({
      id: "run-targeted",
      purpose: "targeted_observe",
      status: "completed",
    });

    await expect(loadFindingsForCompletedRun("run-targeted")).rejects.toThrow(
      /Crawl run not found/,
    );
    expect(listObservationsMock).not.toHaveBeenCalled();
    expect(generateObservationsForCrawlRunMock).not.toHaveBeenCalled();
  });
});
