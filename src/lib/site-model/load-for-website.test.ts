import { describe, expect, it, vi, beforeEach } from "vitest";
import { SITE_MODEL_DERIVATION_VERSION } from "./types";

const findSiteModelForCrawlMock = vi.fn();
const insertSiteModelMock = vi.fn();
const loadSiteModelEvidenceMock = vi.fn();
const updateDraftSiteModelMock = vi.fn();
const findLatestConfirmedSiteModelForWebsiteMock = vi.fn();
const updateDraftInterpretationMock = vi.fn();
const markSiteModelStaleMock = vi.fn();

vi.mock("./repository", () => ({
  findSiteModelForCrawl: (...args: unknown[]) => findSiteModelForCrawlMock(...args),
  insertSiteModel: (...args: unknown[]) => insertSiteModelMock(...args),
  loadSiteModelEvidence: (...args: unknown[]) => loadSiteModelEvidenceMock(...args),
  updateDraftSiteModel: (...args: unknown[]) => updateDraftSiteModelMock(...args),
  findLatestConfirmedSiteModelForWebsite: (...args: unknown[]) =>
    findLatestConfirmedSiteModelForWebsiteMock(...args),
  updateDraftInterpretation: (...args: unknown[]) => updateDraftInterpretationMock(...args),
  markSiteModelStale: (...args: unknown[]) => markSiteModelStaleMock(...args),
}));

import { loadOrCreateSiteModel } from "./load-for-website";

const website = {
  id: "website-foundfy",
  hostname: "foundfy.me",
  displayUrl: "https://www.foundfy.me/",
  firstSeenAt: "2026-09-09T00:00:00.000Z",
  lastCrawledAt: "2026-09-14T00:00:00.000Z",
};

const crawlRun = {
  id: "run-foundfy",
  websiteId: website.id,
  status: "completed" as const,
  seedUrl: "https://foundfy.me/",
  pagesCrawled: 2,
  maxPages: 10,
  errorMessage: null,
  startedAt: "2026-09-14T16:26:10.000Z",
  completedAt: "2026-09-14T16:26:19.000Z",
  createdAt: "2026-09-14T16:25:57.000Z",
};

const evidenceBundle = {
  crawl: {
    id: crawlRun.id,
    website_id: website.id,
    seed_url: crawlRun.seedUrl,
    pages_crawled: 2,
    pages_discovered: 3,
    max_pages: 10,
  },
  pages: [
    {
      id: "page-home",
      requestedUrl: "https://foundfy.me/",
      finalUrl: "https://www.foundfy.me/",
      statusCode: 200,
      title: "Foundfy",
      h1: ["Be found"],
      h2: [],
      h3: [],
      htmlLang: "en",
      urlLocale: null,
      navLabels: [],
      mainExcerpt: "A simpler way",
      contentHash: "abc",
      jsonLdTypes: [],
      jsonLdProperties: [],
      wordCount: 10,
      fetchedAt: "2026-09-14T16:26:12.000Z",
    },
  ],
  artifacts: [],
};

describe("loadOrCreateSiteModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSiteModelEvidenceMock.mockResolvedValue(evidenceBundle);
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue(null);
  });

  it("returns the stored draft when derivation version matches", async () => {
    const existing = {
      id: "model-1",
      websiteId: website.id,
      sourceCrawlRunId: crawlRun.id,
      version: 1,
      status: "draft" as const,
      understanding: { derivationVersion: SITE_MODEL_DERIVATION_VERSION },
      interpretation: null,
      confirmed: null,
      evidence: { source: "crawl" },
      derivedAt: "2026-09-14T16:26:20.000Z",
    };
    findSiteModelForCrawlMock.mockResolvedValue(existing);

    const result = await loadOrCreateSiteModel({ website, crawlRun });

    expect(result).toBe(existing);
    expect(insertSiteModelMock).not.toHaveBeenCalled();
    expect(updateDraftSiteModelMock).not.toHaveBeenCalled();
    expect(updateDraftInterpretationMock).not.toHaveBeenCalled();
  });

  it("does not overwrite a confirmed model", async () => {
    const existing = {
      id: "model-1",
      websiteId: website.id,
      sourceCrawlRunId: crawlRun.id,
      version: 1,
      status: "confirmed" as const,
      understanding: { derivationVersion: 0 },
      interpretation: null,
      confirmed: { siteDescription: "user confirmed" },
      evidence: { source: "crawl" },
      derivedAt: "2026-09-14T16:26:20.000Z",
    };
    findSiteModelForCrawlMock.mockResolvedValue(existing);

    const result = await loadOrCreateSiteModel({ website, crawlRun });

    expect(result).toBe(existing);
    expect(updateDraftSiteModelMock).not.toHaveBeenCalled();
    expect(updateDraftInterpretationMock).not.toHaveBeenCalled();
  });

  it("inserts a draft when none exists", async () => {
    findSiteModelForCrawlMock.mockResolvedValue(null);
    insertSiteModelMock.mockResolvedValue({
      id: "model-new",
      status: "draft",
      understanding: { derivationVersion: SITE_MODEL_DERIVATION_VERSION },
      interpretation: null,
      confirmed: null,
    });

    const result = await loadOrCreateSiteModel({ website, crawlRun });

    expect(result?.id).toBe("model-new");
    expect(insertSiteModelMock).toHaveBeenCalledTimes(1);
    expect(insertSiteModelMock.mock.calls[0]?.[0]?.status).toBe("draft");
    expect(insertSiteModelMock.mock.calls[0]?.[0]?.understanding.pages[0]?.pathClass).toBe(
      "homepage",
    );
    expect(insertSiteModelMock.mock.calls[0]?.[0]?.interpretation).toBeUndefined();
  });

  it("returns an older confirmed model after a later crawl instead of replacing it", async () => {
    findSiteModelForCrawlMock.mockResolvedValue(null);
    insertSiteModelMock.mockResolvedValue({
      id: "model-new-draft",
      status: "draft",
      sourceCrawlRunId: crawlRun.id,
      understanding: { derivationVersion: SITE_MODEL_DERIVATION_VERSION, pages: [] },
      interpretation: null,
      confirmed: null,
    });
    const confirmed = {
      id: "model-confirmed",
      websiteId: website.id,
      sourceCrawlRunId: "run-old",
      status: "confirmed" as const,
      confirmed: { siteDescription: "Foundfy helps people get found." },
    };
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue(confirmed);
    markSiteModelStaleMock.mockResolvedValue({
      ...confirmed,
      status: "stale",
    });

    const result = await loadOrCreateSiteModel({ website, crawlRun });

    expect(insertSiteModelMock).toHaveBeenCalledTimes(1);
    expect(markSiteModelStaleMock).toHaveBeenCalledWith("model-confirmed");
    expect(result?.id).toBe("model-confirmed");
    expect(result?.status).toBe("stale");
    expect(result?.confirmed).toEqual(confirmed.confirmed);
    expect(updateDraftInterpretationMock).not.toHaveBeenCalled();
  });
});
