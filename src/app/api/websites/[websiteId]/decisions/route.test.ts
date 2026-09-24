import { afterEach, describe, expect, it, vi } from "vitest";

const loadDecisionsForWebsiteMock = vi.fn();

vi.mock("@/lib/decisions/load", () => ({
  loadDecisionsForWebsite: (...args: unknown[]) => loadDecisionsForWebsiteMock(...args),
}));

import { ObserveAuthError } from "@/lib/gsc/types";
import { GET } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/websites/[websiteId]/decisions", () => {
  it("requires an owner session", async () => {
    loadDecisionsForWebsiteMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    const response = await GET(new Request("https://www.foundfy.me/decisions"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });

    expect(response.status).toBe(401);
    expect(loadDecisionsForWebsiteMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      sessionToken: null,
    });
    expect(response.headers.get("cache-control")).toBeNull();
  });

  it("denies a session that is not the observe owner", async () => {
    loadDecisionsForWebsiteMock.mockRejectedValue(new ObserveAuthError(403, "Not authorized."));

    const response = await GET(
      new Request("https://www.foundfy.me/decisions", {
        headers: { cookie: "foundfy_gsc_session=other-owner" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(403);
  });

  it("returns owner-private decisions with a private cache header", async () => {
    loadDecisionsForWebsiteMock.mockResolvedValue({
      status: "completed",
      current: true,
      decisions: [{ id: "decision-1", title: "Improve the page title on /es/pintura-en-seda" }],
    });

    const response = await GET(
      new Request("https://www.foundfy.me/decisions", {
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
    expect(await response.json()).toMatchObject({ status: "completed" });
  });
});
