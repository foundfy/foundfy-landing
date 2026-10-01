import { afterEach, describe, expect, it, vi } from "vitest";

const prepareActionMock = vi.fn();

vi.mock("@/lib/actions/lifecycle", () => ({
  prepareAction: (...args: unknown[]) => prepareActionMock(...args),
}));

import { ObserveAuthError } from "@/lib/gsc/types";
import { ActionError } from "@/lib/actions/types";
import { POST } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const DECISION_ID = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/websites/[websiteId]/actions/prepare", () => {
  it("requires an owner session", async () => {
    prepareActionMock.mockRejectedValue(new ObserveAuthError(401, "Owner session required."));

    const response = await POST(
      new Request("https://www.foundfy.me/prepare", {
        method: "POST",
        body: JSON.stringify({ decisionId: DECISION_ID }),
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
  });

  it("returns a prepared preview", async () => {
    prepareActionMock.mockResolvedValue({
      id: "action-1",
      status: "prepared",
      proposedValue: null,
      executeAvailable: false,
    });

    const response = await POST(
      new Request("https://www.foundfy.me/prepare", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
        body: JSON.stringify({ decisionId: DECISION_ID }),
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "prepared", proposedValue: null });
  });

  it("returns 409 for an unsupported Decision", async () => {
    prepareActionMock.mockRejectedValue(
      new ActionError("unsupported_decision", "Foundfy can only prepare a meta description change."),
    );

    const response = await POST(
      new Request("https://www.foundfy.me/prepare", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
        body: JSON.stringify({ decisionId: DECISION_ID }),
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ reason: "unsupported_decision" });
  });
});
