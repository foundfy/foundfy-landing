import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleExplanationEnrichmentIfNeeded } from "./scheduler";

const generateMock = vi.fn();

vi.mock("./explanation/generate", () => ({
  generateExplanationEnrichments: (...args: unknown[]) => generateMock(...args),
  shouldAutoGenerateExplanationEnrichment: (input: {
    highlightedFindingIds: string[];
  }) => input.highlightedFindingIds.length > 0,
}));

describe("scheduleExplanationEnrichmentIfNeeded", () => {
  afterEach(() => {
    delete process.env.AI_ENRICHMENT_ENABLED;
    generateMock.mockReset();
  });

  it("does nothing when AI enrichment is disabled", async () => {
    process.env.AI_ENRICHMENT_ENABLED = "false";

    await scheduleExplanationEnrichmentIfNeeded({
      crawlRunId: "run-1",
      hostname: "example.com",
      pagesCrawled: 1,
      findings: [],
      findingsSummary: {
        totalCount: 1,
        highlightedFindingIds: ["finding-1"],
      },
    });

    expect(generateMock).not.toHaveBeenCalled();
  });

  it("does not schedule enrichment for zero-page crawls", async () => {
    process.env.AI_ENRICHMENT_ENABLED = "true";

    await scheduleExplanationEnrichmentIfNeeded({
      crawlRunId: "run-1",
      hostname: "example.com",
      pagesCrawled: 0,
      findings: [{ id: "finding-1" } as never],
      findingsSummary: {
        totalCount: 2,
        highlightedFindingIds: ["finding-1"],
        highlightGroups: [],
      },
    });

    expect(generateMock).not.toHaveBeenCalled();
  });

  it("skips LOW-only crawls with no highlighted findings", async () => {
    process.env.AI_ENRICHMENT_ENABLED = "true";

    await scheduleExplanationEnrichmentIfNeeded({
      crawlRunId: "run-1",
      hostname: "foundfy.me",
      pagesCrawled: 1,
      findings: [],
      findingsSummary: {
        totalCount: 1,
        highlightedFindingIds: [],
      },
    });

    expect(generateMock).not.toHaveBeenCalled();
  });
});
