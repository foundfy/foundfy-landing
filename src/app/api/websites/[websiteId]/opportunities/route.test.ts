import { afterEach, describe, expect, it, vi } from "vitest";

const loadQueryOpportunitiesMock = vi.fn();

vi.mock("@/lib/opportunities/load", () => ({
  loadQueryOpportunities: (...args: unknown[]) => loadQueryOpportunitiesMock(...args),
}));

import { ObserveAuthError } from "@/lib/gsc/types";
import { GET } from "./route";

const WEBSITE_ID = "cb01711e-7945-4a88-9998-e78fec411509";

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/websites/[websiteId]/opportunities", () => {
  it("requires an owner session", async () => {
    loadQueryOpportunitiesMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    const response = await GET(new Request("https://www.foundfy.me/opportunities"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });

    expect(response.status).toBe(401);
    expect(loadQueryOpportunitiesMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      sessionToken: null,
    });
  });

  it("returns derived opportunities without a write", async () => {
    loadQueryOpportunitiesMock.mockResolvedValue({
      status: "completed",
      empty: false,
      emptyReason: null,
      opportunities: [{ query: "cianotipo" }],
    });

    const response = await GET(new Request("https://www.foundfy.me/opportunities"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.opportunities[0].query).toBe("cianotipo");
    expect(response.headers.get("Cache-Control")).toContain("private");
  });
});
