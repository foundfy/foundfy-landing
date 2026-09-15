import { beforeEach, describe, expect, it, vi } from "vitest";

const getWebsiteByIdMock = vi.fn();
const findLatestConfirmedSiteModelForWebsiteMock = vi.fn();
const upsertWebsiteGoalsMock = vi.fn();

vi.mock("@/lib/websites/repository", () => ({
  getWebsiteById: (...args: unknown[]) => getWebsiteByIdMock(...args),
}));

vi.mock("@/lib/site-model/repository", () => ({
  findLatestConfirmedSiteModelForWebsite: (...args: unknown[]) =>
    findLatestConfirmedSiteModelForWebsiteMock(...args),
}));

vi.mock("./repository", () => ({
  upsertWebsiteGoals: (...args: unknown[]) => upsertWebsiteGoalsMock(...args),
}));

import { saveWebsiteGoals } from "./save";

describe("saveWebsiteGoals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWebsiteByIdMock.mockResolvedValue({ id: "website-foundfy" });
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue({
      id: "model-1",
      status: "confirmed",
      confirmed: { siteDescription: "Foundfy" },
    });
    upsertWebsiteGoalsMock.mockImplementation(async (input) => ({
      id: "goal-1",
      websiteId: input.websiteId,
      primaryType: input.primaryType,
      secondaryType: input.secondaryType,
      note: input.note,
      source: "user_declared",
    }));
  });

  it("stores user-declared goals against the website, not a crawl", async () => {
    const result = await saveWebsiteGoals({
      websiteId: "website-foundfy",
      primaryType: "grow_signups",
      note: "Keep this as private beta context.",
    });

    expect(result.source).toBe("user_declared");
    expect(upsertWebsiteGoalsMock).toHaveBeenCalledWith({
      websiteId: "website-foundfy",
      primaryType: "grow_signups",
      secondaryType: null,
      note: "Keep this as private beta context.",
    });
    expect(upsertWebsiteGoalsMock.mock.calls[0]?.[0]).not.toHaveProperty("crawlRunId");
  });

  it("does not save before the Site Model is confirmed", async () => {
    findLatestConfirmedSiteModelForWebsiteMock.mockResolvedValue(null);

    await expect(
      saveWebsiteGoals({
        websiteId: "website-foundfy",
        primaryType: "grow_signups",
      }),
    ).rejects.toThrow(/confirm what foundfy understands/i);

    expect(upsertWebsiteGoalsMock).not.toHaveBeenCalled();
  });
});
