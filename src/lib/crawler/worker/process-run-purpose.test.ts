import { beforeEach, describe, expect, it, vi } from "vitest";

const claimNextQueuedRunMock = vi.fn();
const markCrawlRunFailedMock = vi.fn();
const toActiveCrawlRunMock = vi.fn();

vi.mock("@/lib/observations/db/repository", () => ({
  generateObservationsForCrawlRun: vi.fn(),
}));

vi.mock("@/lib/analysis-requests/settle", () => ({
  settleAnalysisRequestsForCrawlRun: vi.fn(),
}));

vi.mock("../db/repository", () => ({
  claimNextQueuedRun: (...args: unknown[]) => claimNextQueuedRunMock(...args),
  getCrawlRunSummary: vi.fn(),
  getNextQueueItem: vi.fn(),
  updateQueueItem: vi.fn(),
  incrementCrawlProgress: vi.fn(),
  saveParsedPage: vi.fn(),
  saveLinks: vi.fn(),
  saveSiteArtifact: vi.fn(),
  markCrawlRunCompleted: vi.fn(),
  markCrawlRunFailed: (...args: unknown[]) => markCrawlRunFailedMock(...args),
  enqueueUrl: vi.fn(),
  findPageByRequestedUrl: vi.fn(),
  reconcileOrphanedPageProgress: vi.fn(),
  hasSitemapArtifacts: vi.fn(),
  listQueueUrls: vi.fn(),
  listQueueItems: async () => [],
  updateQueueItemPriority: async () => undefined,
  listPageHostVariantEvidence: async () => [],
  toActiveCrawlRun: (...args: unknown[]) => toActiveCrawlRunMock(...args),
}));

vi.mock("../discover/robots", () => ({
  discoverRobotsUrl: () => "https://example.com/robots.txt",
  discoverDefaultSitemapUrls: () => [],
  isAllowedByRobots: () => true,
  parseRobotsTxt: () => ({ sitemaps: [], disallow: [], allow: [] }),
}));

vi.mock("../security/ssrf-fetch", () => ({
  SsrfValidationError: class SsrfValidationError extends Error {},
  ssrfSafeFetch: vi.fn(),
}));

import { processCrawlRun } from "./process-run";

describe("processCrawlRun purpose isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no-ops when claim returns nothing for a targeted preferred run", async () => {
    claimNextQueuedRunMock.mockResolvedValue(null);

    await expect(processCrawlRun("targeted-run")).resolves.toBeNull();
    expect(toActiveCrawlRunMock).not.toHaveBeenCalled();
    expect(markCrawlRunFailedMock).not.toHaveBeenCalled();
  });

  it("no-ops if a non-site_sample row is passed through to processing", async () => {
    claimNextQueuedRunMock.mockResolvedValue({
      id: "targeted-run",
      purpose: "targeted_observe",
      started_at: "2026-09-10T15:00:00.000Z",
    });

    await expect(processCrawlRun("targeted-run")).resolves.toBeNull();
    expect(toActiveCrawlRunMock).not.toHaveBeenCalled();
    expect(markCrawlRunFailedMock).not.toHaveBeenCalled();
  });
});
