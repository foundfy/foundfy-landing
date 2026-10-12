import { afterEach, describe, expect, it, vi } from "vitest";

const closeResearchForOwnerMock = vi.fn();
const startResearchForOwnerMock = vi.fn();
const recoverResearchForOwnerMock = vi.fn();

vi.mock("@/lib/research/close", () => ({
  closeResearchForOwner: (...args: unknown[]) => closeResearchForOwnerMock(...args),
}));

vi.mock("@/lib/research/start", () => ({
  startResearchForOwner: (...args: unknown[]) => startResearchForOwnerMock(...args),
}));

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

describe("/api/websites/[websiteId]/research/[runId]/close", () => {
  it("requires an owner session", async () => {
    closeResearchForOwnerMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    const response = await POST(new Request("https://www.foundfy.me/research/close", { method: "POST" }), {
      params: Promise.resolve({ websiteId: WEBSITE_ID, runId: RUN_ID }),
    });

    expect(response.status).toBe(401);
    expect(startResearchForOwnerMock).not.toHaveBeenCalled();
    expect(recoverResearchForOwnerMock).not.toHaveBeenCalled();
  });

  it("closes without creating a new run or invoking recovery or start", async () => {
    closeResearchForOwnerMock.mockResolvedValue({
      readiness: { gate: null, surfaceVisible: true },
      run: { id: RUN_ID, status: "closed", canStartNewCycle: true, ideas: [] },
    });

    const response = await POST(new Request("https://www.foundfy.me/research/close", { method: "POST" }), {
      params: Promise.resolve({ websiteId: WEBSITE_ID, runId: RUN_ID }),
    });
    const payload = (await response.json()) as { run?: { status?: string } };

    expect(response.status).toBe(200);
    expect(payload.run?.status).toBe("closed");
    expect(startResearchForOwnerMock).not.toHaveBeenCalled();
    expect(recoverResearchForOwnerMock).not.toHaveBeenCalled();
  });

  it("rejects invalid ids without invoking close", async () => {
    const response = await POST(new Request("https://www.foundfy.me/research/close", { method: "POST" }), {
      params: Promise.resolve({ websiteId: "not-a-uuid", runId: RUN_ID }),
    });
    expect(response.status).toBe(400);
    expect(closeResearchForOwnerMock).not.toHaveBeenCalled();
  });
});
