import { describe, expect, it } from "vitest";
import { deriveExplanationEnrichmentStatus } from "./attach-enrichments";

describe("deriveExplanationEnrichmentStatus", () => {
  it("returns skipped when there are no highlighted findings", () => {
    expect(
      deriveExplanationEnrichmentStatus({
        highlightedFindingIds: [],
        enrichments: [],
      }),
    ).toBe("skipped");
  });

  it("returns pending before enrichments exist", () => {
    expect(
      deriveExplanationEnrichmentStatus({
        highlightedFindingIds: ["finding-1"],
        enrichments: [],
      }),
    ).toBe("pending");
  });

  it("returns ready when all highlighted findings are enriched", () => {
    expect(
      deriveExplanationEnrichmentStatus({
        highlightedFindingIds: ["finding-1", "finding-2"],
        enrichments: [
          { findingId: "finding-1", status: "ready" },
          { findingId: "finding-2", status: "ready" },
        ],
      }),
    ).toBe("ready");
  });
});
