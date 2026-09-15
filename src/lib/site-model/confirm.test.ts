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
});
