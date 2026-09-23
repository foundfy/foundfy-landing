import { afterEach, describe, expect, it, vi } from "vitest";

const bindObservePropertyMock = vi.fn();

vi.mock("@/lib/gsc/properties", () => ({
  bindObserveProperty: (...args: unknown[]) => bindObservePropertyMock(...args),
}));

import { UnverifiedPropertyError } from "@/lib/gsc/types";
import { POST } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/websites/[websiteId]/observe/property", () => {
  it("rejects an unverified property without creating a binding", async () => {
    bindObservePropertyMock.mockRejectedValue(new UnverifiedPropertyError());

    const response = await POST(
      new Request("https://www.foundfy.me/property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: "sc-domain:someone-elses-site.com" }),
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "That Search Console property is not available to this Google account.",
    });
  });
});
