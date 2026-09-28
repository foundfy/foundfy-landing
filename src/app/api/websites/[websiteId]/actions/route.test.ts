import { afterEach, describe, expect, it, vi } from "vitest";

const listActionsForWebsiteMock = vi.fn();

vi.mock("@/lib/actions/lifecycle", () => ({
  listActionsForWebsite: (...args: unknown[]) => listActionsForWebsiteMock(...args),
}));

import { ObserveAuthError } from "@/lib/gsc/types";
import { GET } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/websites/[websiteId]/actions", () => {
  it("requires an owner session", async () => {
    listActionsForWebsiteMock.mockRejectedValue(new ObserveAuthError(401, "Owner session required."));

    const response = await GET(new Request("https://www.foundfy.me/actions"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });

    expect(response.status).toBe(401);
    expect(listActionsForWebsiteMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      sessionToken: null,
    });
  });

  it("returns private no-store action previews", async () => {
    listActionsForWebsiteMock.mockResolvedValue({ actions: [{ id: "action-1", status: "prepared" }] });

    const response = await GET(
      new Request("https://www.foundfy.me/actions", {
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
    expect(await response.json()).toEqual({ actions: [{ id: "action-1", status: "prepared" }] });
  });
});
