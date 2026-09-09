import { describe, expect, it } from "vitest";
import { generateObservationDrafts } from "../engine";
import type { CrawlEvidenceContext } from "../types";

const BASE_CONTEXT: CrawlEvidenceContext = {
  crawlRunId: "fixture-site-discovery",
  websiteId: "fixture-site",
  hostname: "example.test",
  seedUrl: "https://example.test/",
  pages: [],
  links: [],
  queue: [],
  artifacts: [],
};

describe("site discovery fixture", () => {
  it("detects missing robots.txt and sitemap", () => {
    const observations = generateObservationDrafts({
      ...BASE_CONTEXT,
      artifacts: [
        {
          id: "robots-fail",
          artifactType: "robots_txt",
          url: "https://example.test/robots.txt",
          statusCode: 404,
          parsed: null,
        },
        {
          id: "sitemap-fail",
          artifactType: "sitemap_xml",
          url: "https://example.test/sitemap.xml",
          statusCode: 404,
          parsed: null,
        },
      ],
    });

    expect(observations.some((item) => item.ruleKey === "site_discovery.robots_txt_missing")).toBe(
      true,
    );
    expect(observations.some((item) => item.ruleKey === "site_discovery.sitemap_missing")).toBe(
      true,
    );
  });
});
