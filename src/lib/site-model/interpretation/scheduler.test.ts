import { beforeEach, describe, expect, it, vi } from "vitest";

const isAiEnrichmentEnabledMock = vi.fn();
const generateOpenAiSiteInterpretationMock = vi.fn();
const updateDraftInterpretationMock = vi.fn();

vi.mock("@/lib/ai-enrichment/config", () => ({
  isAiEnrichmentEnabled: () => isAiEnrichmentEnabledMock(),
}));

vi.mock("./generate", () => ({
  generateOpenAiSiteInterpretation: (...args: unknown[]) =>
    generateOpenAiSiteInterpretationMock(...args),
}));

vi.mock("../repository", () => ({
  updateDraftInterpretation: (...args: unknown[]) => updateDraftInterpretationMock(...args),
}));

import { scheduleSiteInterpretationIfNeeded } from "./scheduler";
import type { SiteModelRecord } from "../types";

const draftModel = {
  id: "model-1",
  status: "draft",
  understanding: {
    hostname: "foundfy.me",
    seedUrl: "https://foundfy.me/",
    sample: {
      pagesCrawled: 2,
      pagesDiscovered: 3,
      maxPages: 10,
      fetchedHttp200Count: 2,
      sampleIsCapped: true,
      fetchedEveryDiscoveredHtmlPage: false,
    },
    pageTypeCounts: [],
    pages: [],
    languages: { htmlLangs: ["en"], urlLocales: [] },
    navigationLabels: [],
    jsonLdTypes: [],
    jsonLdPropertyCount: 0,
    siteDiscovery: { robots: null, sitemaps: [] },
  },
  evidence: {
    source: "crawl",
    websiteId: "website-1",
    crawlRunId: "run-1",
    pageIds: [],
    artifactIds: [],
    fields: [],
  },
  interpretation: {
    generator: "heuristic",
    status: "ready",
    evidenceHash: "old-hash",
    siteDescription: "Draft",
    offers: [],
    audiences: [],
    locations: [],
    uncertainty: [],
    promptVersion: "site-interpretation-v1",
    generatedAt: "2026-09-15T12:00:00.000Z",
    sourceCrawlRunId: "run-1",
  },
} as unknown as SiteModelRecord;

describe("scheduleSiteInterpretationIfNeeded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAiEnrichmentEnabledMock.mockReturnValue(true);
  });

  it("does nothing when AI is disabled", async () => {
    isAiEnrichmentEnabledMock.mockReturnValue(false);
    await scheduleSiteInterpretationIfNeeded(draftModel);
    expect(generateOpenAiSiteInterpretationMock).not.toHaveBeenCalled();
  });

  it("does not change a confirmed model", async () => {
    await scheduleSiteInterpretationIfNeeded({
      ...draftModel,
      status: "confirmed",
    });
    expect(generateOpenAiSiteInterpretationMock).not.toHaveBeenCalled();
  });

  it("swallows generation failures so /site can keep the heuristic draft", async () => {
    generateOpenAiSiteInterpretationMock.mockRejectedValue(new Error("timeout"));
    await expect(scheduleSiteInterpretationIfNeeded(draftModel)).resolves.toBeUndefined();
    expect(updateDraftInterpretationMock).not.toHaveBeenCalled();
  });
});
