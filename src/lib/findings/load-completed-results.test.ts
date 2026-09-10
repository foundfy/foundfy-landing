import { afterEach, describe, expect, it, vi } from "vitest";

const loadFindingsMock = vi.fn();
const attachMock = vi.fn();

vi.mock("./load-for-run", () => ({
  loadFindingsForCompletedRun: (...args: unknown[]) => loadFindingsMock(...args),
}));

vi.mock("@/lib/ai-enrichment/attach-enrichments", () => ({
  attachExplanationEnrichments: (...args: unknown[]) => attachMock(...args),
}));

describe("loadCompletedCrawlResults", () => {
  afterEach(() => {
    delete process.env.AI_ENRICHMENT_ENABLED;
    loadFindingsMock.mockReset();
    attachMock.mockReset();
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

    const { loadCompletedCrawlResults } = await import("./load-completed-results");
    const result = await loadCompletedCrawlResults("run-1");

    expect(result.explanationEnrichmentStatus).toBe("disabled");
    expect(attachMock).not.toHaveBeenCalled();
    expect(result.findings).toEqual([{ id: "finding-1", title: "Finding" }]);
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
