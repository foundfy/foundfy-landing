import { afterEach, describe, expect, it, vi } from "vitest";

const verifyActionMock = vi.fn();
const getActionPreviewMock = vi.fn();

vi.mock("@/lib/actions/verify", () => ({
  verifyAction: (...args: unknown[]) => verifyActionMock(...args),
}));

vi.mock("@/lib/actions/lifecycle", () => ({
  getActionPreview: (...args: unknown[]) => getActionPreviewMock(...args),
}));

import { ObserveAuthError } from "@/lib/gsc/types";
import { ActionError } from "@/lib/actions/types";
import { POST } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const ACTION_ID = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/websites/[websiteId]/actions/[actionId]/verify", () => {
  it("requires an owner session", async () => {
    verifyActionMock.mockRejectedValue(new ObserveAuthError(401, "Owner session required."));

    const response = await POST(new Request("https://www.foundfy.me/verify", { method: "POST" }), {
      params: Promise.resolve({ websiteId: WEBSITE_ID, actionId: ACTION_ID }),
    });

    expect(response.status).toBe(401);
    expect(getActionPreviewMock).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
  });

  it("returns fresh_crawl_required without treating it as verification failure", async () => {
    verifyActionMock.mockRejectedValue(
      new ActionError("fresh_crawl_required", "Run a new scan to verify that this change is live."),
    );

    const response = await POST(
      new Request("https://www.foundfy.me/verify", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID, actionId: ACTION_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.reason).toBe("fresh_crawl_required");
    expect(getActionPreviewMock).not.toHaveBeenCalled();
  });

  it("returns the private preview after a verification check", async () => {
    verifyActionMock.mockResolvedValue({ id: "verification-1", status: "verified" });
    getActionPreviewMock.mockResolvedValue({
      id: ACTION_ID,
      status: "executed",
      verification: { state: "verified", canCheck: false },
    });

    const response = await POST(
      new Request("https://www.foundfy.me/verify", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID, actionId: ACTION_ID }) },
    );

    expect(response.status).toBe(200);
    expect(verifyActionMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      sessionToken: "owner-token",
      actionId: ACTION_ID,
    });
    expect(await response.json()).toMatchObject({
      status: "executed",
      verification: { state: "verified" },
    });
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
  });
});
