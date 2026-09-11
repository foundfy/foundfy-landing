import { describe, expect, it } from "vitest";
import {
  mergeCrawlStatusPayload,
  resolveInitialCrawlViewPhase,
  resolvePollTransition,
  shouldPollExplanationEnrichment,
} from "./crawl-status-loader";
import type { CrawlStatusPayload } from "./crawl-status";

describe("crawl status loader", () => {
  it("treats completed crawls as completed on initial load", () => {
    expect(
      resolveInitialCrawlViewPhase({ status: "completed", httpStatus: 200 }),
    ).toEqual({
      phase: "completed",
      errorMessage: null,
    });
  });

  it("treats legacy zero-page completed crawls as failed", () => {
    expect(
      resolveInitialCrawlViewPhase({ status: "failed", httpStatus: 200 }),
    ).toEqual({
      phase: "failed",
      errorMessage: null,
    });
  });

  it("maps unknown crawl ids to not_found", () => {
    expect(
      resolveInitialCrawlViewPhase({ status: "failed", httpStatus: 404 }),
    ).toEqual({
      phase: "not_found",
      errorMessage: "Scan not found.",
    });
  });

  it("keeps queued and running scans in analyzing phase", () => {
    expect(
      resolveInitialCrawlViewPhase({ status: "running", httpStatus: 200 }),
    ).toEqual({
      phase: "analyzing",
      errorMessage: null,
    });
  });

  it("continues polling until completed or failed", () => {
    expect(resolvePollTransition("running")).toBe("continue");
    expect(resolvePollTransition("completed")).toBe("completed");
    expect(resolvePollTransition("failed")).toBe("failed");
  });

  it("merges findings without dropping prior payload fields", () => {
    const current = {
      id: "run-1",
      websiteId: "website-1",
      status: "running",
      hostname: "ekoiq.com",
      seedUrl: "https://www.ekoiq.com/",
      maxPages: 10,
      pagesCrawled: 2,
      pagesDiscovered: 5,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: "2026-09-11T00:00:00.000Z",
    } satisfies CrawlStatusPayload;

    const next = {
      ...current,
      status: "completed" as const,
      pagesCrawled: 10,
      findings: [{ id: "finding-1" }],
      findingsSummary: {
        totalCount: 1,
        highlightedFindingIds: ["finding-1"],
        highlightGroups: [],
      },
    };

    expect(mergeCrawlStatusPayload(current, next as CrawlStatusPayload).findings).toEqual([
      { id: "finding-1" },
    ]);
  });

  it("polls explanation enrichment only while pending", () => {
    const payload = {
      id: "run-1",
      websiteId: "website-1",
      status: "completed",
      hostname: "ekoiq.com",
      seedUrl: "https://www.ekoiq.com/",
      maxPages: 10,
      pagesCrawled: 10,
      pagesDiscovered: 10,
      errorMessage: null,
      startedAt: null,
      completedAt: "2026-09-11T00:00:00.000Z",
      createdAt: "2026-09-11T00:00:00.000Z",
      findingsSummary: {
        totalCount: 1,
        highlightedFindingIds: ["finding-1"],
        highlightGroups: [],
      },
      explanationEnrichmentStatus: "pending" as const,
    } satisfies CrawlStatusPayload;

    expect(shouldPollExplanationEnrichment(payload)).toBe(true);

    expect(
      shouldPollExplanationEnrichment({
        ...payload,
        explanationEnrichmentStatus: "ready",
      }),
    ).toBe(false);
  });
});
