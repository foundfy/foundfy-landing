import { afterEach, describe, expect, it, vi } from "vitest";

const switchPreBindGoogleAccountMock = vi.fn();

vi.mock("@/lib/gsc/observe", () => ({
  switchPreBindGoogleAccount: (...args: unknown[]) => switchPreBindGoogleAccountMock(...args),
}));

import { ObserveAuthError, ObserveOwnerConflictError } from "@/lib/gsc/types";
import { POST } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/websites/[websiteId]/observe/switch-account", () => {
  it("requires an owner session", async () => {
    switchPreBindGoogleAccountMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    const response = await POST(new Request("https://www.foundfy.me/switch", { method: "POST" }), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });

    expect(response.status).toBe(401);
  });

  it("does not switch identities after a property is bound", async () => {
    switchPreBindGoogleAccountMock.mockRejectedValue(new ObserveOwnerConflictError());

    const response = await POST(new Request("https://www.foundfy.me/switch", { method: "POST" }), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });

    expect(response.status).toBe(409);
  });
});
