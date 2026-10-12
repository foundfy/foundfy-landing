import { afterEach, describe, expect, it, vi } from "vitest";

const recoverResearchForOwnerMock = vi.fn();

vi.mock("@/lib/research/recover", () => ({
  recoverResearchForOwner: (...args: unknown[]) => recoverResearchForOwnerMock(...args),
}));

import { ObserveAuthError } from "@/lib/gsc/types";
import { POST } from "./route";

const WEBSITE_ID = "cb01711e-7945-4a88-9998-e78fec411509";
const RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/websites/[websiteId]/research/[runId]/recover", () => {
  it("requires an owner session", async () => {
    recoverResearchForOwnerMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    const response = await POST(new Request("https://www.foundfy.me/research/recover", { method: "POST" }), {
      params: Promise.resolve({ websiteId: WEBSITE_ID, runId: RUN_ID }),
    });

    expect(response.status).toBe(401);
  });

  it("rejects invalid ids without invoking recovery", async () => {
    const response = await POST(new Request("https://www.foundfy.me/research/recover", { method: "POST" }), {
      params: Promise.resolve({ websiteId: "not-a-uuid", runId: RUN_ID }),
    });
    expect(response.status).toBe(400);
    expect(recoverResearchForOwnerMock).not.toHaveBeenCalled();
  });
});
