import { afterEach, describe, expect, it, vi } from "vitest";

const syncSearchAnalyticsMock = vi.fn();

vi.mock("@/lib/gsc/sync", () => ({
  syncSearchAnalytics: (...args: unknown[]) => syncSearchAnalyticsMock(...args),
}));

import { SearchConsoleNotConnectedError } from "@/lib/gsc/types";
import { POST } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/websites/[websiteId]/observe/search-analytics/sync", () => {
  it("requires an active Search Console property", async () => {
    syncSearchAnalyticsMock.mockRejectedValue(new SearchConsoleNotConnectedError());

    const response = await POST(
      new Request("https://www.foundfy.me/search-analytics/sync", { method: "POST" }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Search Console is not connected." });
  });
});
