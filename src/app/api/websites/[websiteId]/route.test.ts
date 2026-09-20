import { afterEach, describe, expect, it, vi } from "vitest";

const loadWebsiteOverviewMock = vi.fn();
const scheduleSiteInterpretationIfNeededMock = vi.fn();
const afterMock = vi.fn((callback: () => Promise<void>) => {
  void callback();
});

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (callback: () => Promise<void>) => afterMock(callback),
  };
});

vi.mock("@/lib/websites/load-overview", () => ({
  loadWebsiteOverview: (...args: unknown[]) => loadWebsiteOverviewMock(...args),
}));

vi.mock("@/lib/site-model/interpretation/scheduler", () => ({
  scheduleSiteInterpretationIfNeeded: (...args: unknown[]) =>
    scheduleSiteInterpretationIfNeededMock(...args),
}));

import { GET } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/websites/[websiteId]", () => {
  it("does not include private Google OAuth or OBSERVE fields", async () => {
    loadWebsiteOverviewMock.mockResolvedValue({
      website: {
        id: WEBSITE_ID,
        hostname: "foundfy.me",
        displayUrl: "https://www.foundfy.me/",
        firstSeenAt: "2026-09-10T00:00:00.000Z",
        lastCrawledAt: "2026-09-11T00:00:00.000Z",
      },
      latestUsableScan: null,
      highlightedFindings: [],
      siteModel: { status: "confirmed" },
      goals: { primaryType: "grow_signups" },
      activeScan: null,
      scanHistory: [],
    });

    const response = await GET(new Request("https://www.foundfy.me/api/websites/id"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });
    const payload = await response.json();
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload).not.toHaveProperty("observe");
    expect(payload).not.toHaveProperty("googleIdentity");
    expect(payload).not.toHaveProperty("email");
    expect(serialized).not.toMatch(/refresh_token|google_sub|gsc_|ciphertext|oauth/i);
    expect(payload.goals.primaryType).toBe("grow_signups");
    expect(payload.siteModel.status).toBe("confirmed");
  });
});
