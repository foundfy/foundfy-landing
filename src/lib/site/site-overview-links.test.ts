import { describe, expect, it } from "vitest";
import type { WebsiteOverview } from "@/lib/websites/types";
import { buildSiteOverviewLinks } from "./site-overview-view-model";

describe("site overview links", () => {
  it("links latest usable and history scans to their own crawl ids", () => {
    const overview: WebsiteOverview = {
      website: {
        id: "website-1",
        hostname: "ekoiq.com",
        displayUrl: "https://www.ekoiq.com/",
        firstSeenAt: "2026-09-10T00:00:00.000Z",
        lastCrawledAt: "2026-09-11T00:00:00.000Z",
      },
      latestUsableScan: {
        crawlRunId: "run-usable",
        completedAt: "2026-09-10T15:01:00.000Z",
        pagesCrawled: 10,
        findings: [],
        findingsSummary: {
          totalCount: 22,
          highlightedFindingIds: [],
          highlightGroups: [],
        },
        comparison: null,
        explanationEnrichmentStatus: "ready",
      },
      highlightedFindings: [],
      activeScan: {
        crawlRunId: "run-active",
        status: "running",
        pagesCrawled: 2,
        maxPages: 10,
      },
      scanHistory: [
        {
          crawlRunId: "run-failed",
          status: "failed",
          createdAt: "2026-09-11T00:00:00.000Z",
          startedAt: null,
          completedAt: "2026-09-11T00:01:00.000Z",
          pagesCrawled: 0,
          findingsCount: null,
        },
        {
          crawlRunId: "run-usable",
          status: "completed",
          createdAt: "2026-09-10T00:00:00.000Z",
          startedAt: null,
          completedAt: "2026-09-10T15:01:00.000Z",
          pagesCrawled: 10,
          findingsCount: 22,
        },
      ],
    };

    const links = buildSiteOverviewLinks(overview);

    expect(links.latestScanHref).toBe("/scan/run-usable");
    expect(links.activeScanHref).toBe("/scan/run-active");
    expect(links.historyHrefs).toEqual(["/scan/run-failed", "/scan/run-usable"]);
  });
});
