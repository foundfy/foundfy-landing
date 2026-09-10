import { afterEach, describe, expect, it, vi } from "vitest";

const loadFindingsMock = vi.fn();
const attachMock = vi.fn();
const compareMock = vi.fn();

vi.mock("./load-for-run", () => ({
  loadFindingsForCompletedRun: (...args: unknown[]) => loadFindingsMock(...args),
}));

vi.mock("./comparison/compare-crawls", () => ({
  compareWithPreviousCrawl: (...args: unknown[]) => compareMock(...args),
}));

vi.mock("@/lib/ai-enrichment/attach-enrichments", () => ({
  attachExplanationEnrichments: (...args: unknown[]) => attachMock(...args),
}));

describe("loadCompletedCrawlResults", () => {
  afterEach(() => {
    delete process.env.AI_ENRICHMENT_ENABLED;
    loadFindingsMock.mockReset();
    attachMock.mockReset();
    compareMock.mockReset();
  });

  it("returns deterministic findings unchanged when AI is disabled", async () => {
    process.env.AI_ENRICHMENT_ENABLED = "false";
    loadFindingsMock.mockResolvedValue({
      findings: [{ id: "finding-1", title: "Finding" }],
      findingsSummary: {
        totalCount: 1,
        highlightedFindingIds: [],
        highlightGroups: [],
      },
    });
    compareMock.mockResolvedValue(null);

    const { loadCompletedCrawlResults } = await import("./load-completed-results");
    const result = await loadCompletedCrawlResults("run-1");

    expect(result.explanationEnrichmentStatus).toBe("disabled");
    expect(attachMock).not.toHaveBeenCalled();
    expect(result.findings).toEqual([{ id: "finding-1", title: "Finding" }]);
    expect(result.comparison).toBeUndefined();
  });

  it("attaches comparison change statuses before optional AI enrichment", async () => {
    process.env.AI_ENRICHMENT_ENABLED = "true";
    loadFindingsMock.mockResolvedValue({
      findings: [{ id: "finding-1", title: "Finding" }],
      findingsSummary: {
        totalCount: 1,
        highlightedFindingIds: ["finding-1"],
        highlightGroups: [],
      },
    });
    compareMock.mockResolvedValue({
      comparison: {
        previousCrawlRunId: "prev-run",
        previousCompletedAt: "2026-01-01T00:00:00.000Z",
        fixed: 0,
        stillPresent: 1,
        new: 0,
        unverified: 0,
        fixedFindings: [],
      },
      changeStatusByObservationId: new Map([["finding-1", "still_present"]]),
    });
    attachMock.mockResolvedValue({
      findings: [{ id: "finding-1", title: "Finding", changeStatus: "still_present" }],
      explanationEnrichmentStatus: "pending",
    });

    const { loadCompletedCrawlResults } = await import("./load-completed-results");
    const result = await loadCompletedCrawlResults("run-1");

    expect(result.comparison?.stillPresent).toBe(1);
    expect(attachMock).toHaveBeenCalledWith(
      expect.objectContaining({
        findings: [{ id: "finding-1", title: "Finding", changeStatus: "still_present" }],
      }),
    );
  });

  it("does not block on enrichment generation", async () => {
    process.env.AI_ENRICHMENT_ENABLED = "true";
    loadFindingsMock.mockResolvedValue({
      findings: [{ id: "finding-1", title: "Finding" }],
      findingsSummary: {
        totalCount: 1,
        highlightedFindingIds: ["finding-1"],
        highlightGroups: [
          {
            representativeFindingId: "finding-1",
            memberFindingIds: ["finding-1"],
            rawFindingCount: 1,
            affectedPageCount: 1,
          },
        ],
      },
    });
    attachMock.mockResolvedValue({
      findings: [{ id: "finding-1", title: "Finding" }],
      explanationEnrichmentStatus: "pending",
    });

    const { loadCompletedCrawlResults } = await import("./load-completed-results");
    const result = await loadCompletedCrawlResults("run-1");

    expect(result.explanationEnrichmentStatus).toBe("pending");
    expect(result.findings[0]?.title).toBe("Finding");
  });
});
