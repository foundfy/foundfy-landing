import { afterEach, describe, expect, it, vi } from "vitest";

const setupSearchPresenceMock = vi.fn();

vi.mock("@/lib/gsc/setup", () => ({
  setupSearchPresence: (...args: unknown[]) => setupSearchPresenceMock(...args),
}));

import { ObserveAuthError } from "@/lib/gsc/types";
import { POST } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/websites/[websiteId]/observe/setup", () => {
  it("requires an owner session and ignores a client domain target", async () => {
    setupSearchPresenceMock.mockRejectedValue(new ObserveAuthError(401, "Owner session required."));

    const response = await POST(
      new Request("https://www.foundfy.me/setup", {
        method: "POST",
        body: JSON.stringify({ domain: "evil.example" }),
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(401);
    expect(setupSearchPresenceMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      sessionToken: null,
      requestedDomain: "evil.example",
    });
  });
});
