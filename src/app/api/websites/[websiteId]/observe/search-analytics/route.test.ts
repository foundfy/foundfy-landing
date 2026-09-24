import { afterEach, describe, expect, it, vi } from "vitest";

const loadSearchAnalyticsEvidenceMock = vi.fn();

vi.mock("@/lib/gsc/evidence", () => ({
  loadSearchAnalyticsEvidence: (...args: unknown[]) =>
    loadSearchAnalyticsEvidenceMock(...args),
}));

import { ObserveAuthError } from "@/lib/gsc/types";
import { GET } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/websites/[websiteId]/observe/search-analytics", () => {
  it("requires an owner session", async () => {
    loadSearchAnalyticsEvidenceMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    const response = await GET(new Request("https://www.foundfy.me/search-analytics"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });

    expect(response.status).toBe(401);
    expect(loadSearchAnalyticsEvidenceMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      sessionToken: null,
    });
  });
});
