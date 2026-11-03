import { beforeEach, describe, expect, it, vi } from "vitest";

const getWebsiteByIdMock = vi.fn();
const findLatestUsableCrawlRunMock = vi.fn();
const loadOrCreateSiteModelMock = vi.fn();
const confirmSiteModelRowMock = vi.fn();

vi.mock("@/lib/websites/repository", () => ({
  getWebsiteById: (...args: unknown[]) => getWebsiteByIdMock(...args),
  findLatestUsableCrawlRun: (...args: unknown[]) => findLatestUsableCrawlRunMock(...args),
}));

vi.mock("./load-for-website", () => ({
  loadOrCreateSiteModel: (...args: unknown[]) => loadOrCreateSiteModelMock(...args),
}));

vi.mock("./repository", () => ({
  confirmSiteModelRow: (...args: unknown[]) => confirmSiteModelRowMock(...args),
}));

import { confirmWebsiteSiteModel } from "./confirm";

describe("confirmWebsiteSiteModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWebsiteByIdMock.mockResolvedValue({
      id: "website-foundfy",
      hostname: "foundfy.me",
    });
    findLatestUsableCrawlRunMock.mockResolvedValue({
      id: "run-foundfy",
    });
  });

  it("writes confirmed fields and preserves the original draft interpretation", async () => {
    const draftInterpretation = {
      generatedAt: "2026-09-15T12:00:00.000Z",
      generator: "heuristic",
      evidenceHash: "hash-1",
      siteDescription: "Draft description from crawl evidence.",
      offers: [],
      audiences: [],
      locations: [],
      uncertainty: ["Only 2 pages were fetched."],
    };
    loadOrCreateSiteModelMock.mockResolvedValue({
      id: "model-1",
      sourceCrawlRunId: "run-foundfy",
      status: "draft",
      interpretation: draftInterpretation,
      confirmed: null,
      evidence: { crawlRunId: "run-foundfy" },
    });
    confirmSiteModelRowMock.mockImplementation(async (input) => ({
      id: input.id,
      status: "confirmed",
      interpretation: draftInterpretation,
      confirmed: input.confirmed,
    }));

    const result = await confirmWebsiteSiteModel({
      websiteId: "website-foundfy",
      fields: {
        siteDescription: "Foundfy is a search visibility product.",
        offers: ["search visibility"],
        audiences: ["website owners"],
        locations: [],
      },
    });

    expect(result.status).toBe("confirmed");
    expect(result.interpretation).toEqual(draftInterpretation);
    expect(result.confirmed?.siteDescription).toBe(
      "Foundfy is a search visibility product.",
    );
    expect(result.confirmed?.audiences).toEqual(["website owners"]);
    expect(confirmSiteModelRowMock.mock.calls[0]?.[0]?.id).toBe("model-1");
  });

  it("rejects an empty description", async () => {
    loadOrCreateSiteModelMock.mockResolvedValue({
      id: "model-1",
      interpretation: null,
      evidence: { crawlRunId: "run-foundfy" },
    });

    await expect(
      confirmWebsiteSiteModel({
        websiteId: "website-foundfy",
        fields: {
          siteDescription: "   ",
          offers: [],
          audiences: [],
          locations: [],
        },
      }),
    ).rejects.toThrow(/description is required/i);

    expect(confirmSiteModelRowMock).not.toHaveBeenCalled();
  });

  it("saves multiple selcuk-style services without dropping siblings", async () => {
    const draftInterpretation = {
      generatedAt: "2026-11-01T12:00:00.000Z",
      generator: "heuristic" as const,
      evidenceHash: "hash-selcuk",
      siteDescription: "The homepage heading is “Filmmaking”.",
      offers: ["Filmmaking"],
      audiences: [],
      locations: [],
      uncertainty: [],
    };
    loadOrCreateSiteModelMock.mockResolvedValue({
      id: "model-selcuk",
      websiteId: "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2",
      sourceCrawlRunId: "run-selcuk",
      status: "draft",
      interpretation: draftInterpretation,
      confirmed: null,
      evidence: { crawlRunId: "run-selcuk" },
    });
    confirmSiteModelRowMock.mockImplementation(async (input) => ({
      id: input.id,
      status: "confirmed",
      interpretation: draftInterpretation,
      confirmed: input.confirmed,
    }));

    const first = await confirmWebsiteSiteModel({
      websiteId: "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2",
      fields: {
        siteDescription: "Selcuk Demirci makes films for artists and brands.",
        offers: ["Filmmaking", "Wedding films", ""],
        audiences: ["artists"],
        locations: [],
      },
    });
    expect(first.confirmed?.offers).toEqual(["Filmmaking", "Wedding films"]);
    expect(first.interpretation).toEqual(draftInterpretation);

    const second = await confirmWebsiteSiteModel({
      websiteId: "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2",
      fields: {
        siteDescription: "Selcuk Demirci makes films for artists and brands.",
        offers: ["Wedding and event films", "Wedding films"],
        audiences: ["artists"],
        locations: [],
      },
    });
    expect(second.confirmed?.offers).toEqual([
      "Wedding and event films",
      "Wedding films",
    ]);
    expect(second.confirmed?.siteDescription).toBe(
      "Selcuk Demirci makes films for artists and brands.",
    );
    expect(second.interpretation).toEqual(draftInterpretation);
  });

  it("does not confirm website B with website A fields", async () => {
    getWebsiteByIdMock.mockImplementation(async (websiteId: string) => ({
      id: websiteId,
      hostname: websiteId === "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2" ? "selcukdemirci.me" : "b.example",
    }));
    findLatestUsableCrawlRunMock.mockImplementation(async (websiteId: string) => ({
      id: `run-${websiteId}`,
    }));
    loadOrCreateSiteModelMock.mockImplementation(async (input: { website: { id: string } }) => ({
      id: `model-${input.website.id}`,
      websiteId: input.website.id,
      sourceCrawlRunId: `run-${input.website.id}`,
      interpretation: {
        generatedAt: "2026-11-01T12:00:00.000Z",
        generator: "heuristic",
        evidenceHash: "hash",
        siteDescription: "Draft",
        offers: [],
        audiences: [],
        locations: [],
        uncertainty: [],
      },
      evidence: { crawlRunId: `run-${input.website.id}` },
    }));
    confirmSiteModelRowMock.mockImplementation(async (input) => ({
      id: input.id,
      confirmed: input.confirmed,
    }));

    await confirmWebsiteSiteModel({
      websiteId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      fields: {
        siteDescription: "Website B only.",
        offers: ["Website B service"],
        audiences: [],
        locations: [],
      },
    });

    expect(loadOrCreateSiteModelMock.mock.calls[0]?.[0]?.website?.id).toBe(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    expect(confirmSiteModelRowMock.mock.calls[0]?.[0]?.id).toBe(
      "model-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    expect(confirmSiteModelRowMock.mock.calls[0]?.[0]?.confirmed?.offers).toEqual([
      "Website B service",
    ]);
  });
});
