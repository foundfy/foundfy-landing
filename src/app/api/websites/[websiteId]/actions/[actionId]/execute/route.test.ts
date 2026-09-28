import { afterEach, describe, expect, it, vi } from "vitest";

const executeActionMock = vi.fn();

vi.mock("@/lib/actions/lifecycle", () => ({
  executeAction: (...args: unknown[]) => executeActionMock(...args),
}));

import { ActionError } from "@/lib/actions/types";
import { POST } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const ACTION_ID = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/websites/[websiteId]/actions/[actionId]/execute", () => {
  it("fail-closes with adapter_not_connected", async () => {
    executeActionMock.mockRejectedValue(
      new ActionError(
        "adapter_not_connected",
        "Foundfy cannot apply this change until a site connection exists.",
      ),
    );

    const response = await POST(
      new Request("https://www.foundfy.me/execute", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID, actionId: ACTION_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.reason).toBe("adapter_not_connected");
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
  });
});
