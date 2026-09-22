import { afterEach, describe, expect, it, vi } from "vitest";

const disconnectObserveOwnerMock = vi.fn();

vi.mock("@/lib/gsc/observe", () => ({
  disconnectObserveOwner: (...args: unknown[]) => disconnectObserveOwnerMock(...args),
}));

import { ObserveAuthError } from "@/lib/gsc/types";
import { POST } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/websites/[websiteId]/observe/disconnect", () => {
  it("requires an owner session", async () => {
    disconnectObserveOwnerMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    const response = await POST(new Request("https://www.foundfy.me/disconnect"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });

    expect(response.status).toBe(401);
  });

  it("clears the session cookie after a successful owner disconnect", async () => {
    disconnectObserveOwnerMock.mockResolvedValue(undefined);

    const response = await POST(
      new Request("https://www.foundfy.me/disconnect", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );
    const cookies = response.headers.getSetCookie?.().join("\n") ?? "";

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(cookies).toMatch(/foundfy_gsc_session=/);
    expect(cookies).toMatch(/Max-Age=0/i);
  });
});
