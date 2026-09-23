import { afterEach, describe, expect, it, vi } from "vitest";

const resolveObserveOwnerViewMock = vi.fn();

vi.mock("@/lib/gsc/observe", () => ({
  resolveObserveOwnerView: (...args: unknown[]) => resolveObserveOwnerViewMock(...args),
}));

import { ObserveAuthError } from "@/lib/gsc/types";
import { GET } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/websites/[websiteId]/observe", () => {
  it("denies unauthenticated callers", async () => {
    resolveObserveOwnerViewMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    const response = await GET(new Request("https://www.foundfy.me/api/websites/id/observe"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "Owner session required." });
    expect(JSON.stringify(payload)).not.toMatch(/refresh|ciphertext|google_sub/i);
  });

  it("denies the wrong Google identity", async () => {
    resolveObserveOwnerViewMock.mockRejectedValue(new ObserveAuthError(403, "Not authorized."));

    const response = await GET(
      new Request("https://www.foundfy.me/api/websites/id/observe", {
        headers: { cookie: "foundfy_gsc_session=other-identity" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(403);
  });

  it("returns owner-private Google connection state without credentials", async () => {
    resolveObserveOwnerViewMock.mockResolvedValue({
      status: "google_connected",
      email: "jose@foundfy.me",
      propertySelected: false,
      property: null,
    });

    const response = await GET(
      new Request("https://www.foundfy.me/api/websites/id/observe", {
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      status: "google_connected",
      email: "jose@foundfy.me",
      propertySelected: false,
      property: null,
    });
    expect(JSON.stringify(payload)).not.toMatch(/refresh|ciphertext|access_token/i);
  });
});
