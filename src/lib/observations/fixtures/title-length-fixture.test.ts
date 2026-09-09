import { describe, expect, it } from "vitest";
import { generateObservationDrafts } from "../engine";
import type { CrawlEvidenceContext } from "../types";

describe("title length fixture", () => {
  it("detects titles outside the recommended range", () => {
    const observations = generateObservationDrafts({
      crawlRunId: "fixture-title-length",
      websiteId: "fixture-site",
      hostname: "example.test",
      seedUrl: "https://example.test/",
      pages: [
        {
          id: "page-short-title",
          requestedUrl: "https://example.test/short",
          finalUrl: "https://example.test/short",
          statusCode: 200,
          redirectChain: [],
          title: "Too short",
          metaDescription: "Description",
          canonical: "https://example.test/short",
          robotsMeta: null,
          xRobotsTag: null,
          h1: ["Heading"],
          internalLinkCount: 0,
        },
      ],
      links: [],
      queue: [],
      artifacts: [],
    });

    const match = observations.find(
      (item) => item.ruleKey === "page_fundamentals.title_length_out_of_range",
    );

    expect(match?.severity).toBe("info");
    expect(match?.evidence.titleLength).toBe("Too short".length);
  });
});
