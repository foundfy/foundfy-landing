import { afterEach, describe, expect, it, vi } from "vitest";
import { ObserveAuthError } from "@/lib/gsc/types";

const inspectRelatedDemandForOwnerMock = vi.fn();
const inspectRelatedDemandAfterObservationForOwnerMock = vi.fn();

vi.mock("@/lib/decisions/inspect", () => ({
  inspectRelatedDemandForOwner: (...args: unknown[]) => inspectRelatedDemandForOwnerMock(...args),
  inspectRelatedDemandAfterObservationForOwner: (...args: unknown[]) =>
    inspectRelatedDemandAfterObservationForOwnerMock(...args),
  RelatedDemandInspectError: class RelatedDemandInspectError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status = 409) {
      super(message);
      this.name = "RelatedDemandInspectError";
      this.code = code;
      this.status = status;
    }
  },
}));

vi.mock("@/lib/gsc/cookie", () => ({
  readObserveSessionToken: () => "owner-session",
}));

import { POST } from "./route";

const WEBSITE_ID = "cb01711e-7945-4a88-9998-e78fec411509";
const IDEA_ID = "477889f4-ce3e-401b-88f6-57fd25e30df2";

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/websites/[websiteId]/research/ideas/[ideaId]/inspect", () => {
  it("requires an owner session", async () => {
    inspectRelatedDemandForOwnerMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );
    const response = await POST(new Request("https://www.foundfy.me/inspect", { method: "POST" }), {
      params: Promise.resolve({ websiteId: WEBSITE_ID, ideaId: IDEA_ID }),
    });
    expect(response.status).toBe(401);
    expect(inspectRelatedDemandForOwnerMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      ideaId: IDEA_ID,
      sessionToken: "owner-session",
    });
  });

  it("returns the inspection view for an authorized owner", async () => {
    inspectRelatedDemandForOwnerMock.mockResolvedValue({
      decisionId: "decision-1",
      runId: "run-1",
      state: "no_obvious_match_in_current_crawl",
      resultCopy: "Foundfy did not find an obvious match in the current crawl sample.",
      gscCopy: "Google Search evidence is not available for this inspection.",
      crawlBounded: true,
      crawlBoundedCopy:
        "This inspection used the current crawl sample: 10 pages fetched from 347 discovered URLs.",
      nextStepCopy: "Review current pages and evidence. Foundfy is not recommending a change yet.",
    });
    const response = await POST(new Request("https://www.foundfy.me/inspect", { method: "POST" }), {
      params: Promise.resolve({ websiteId: WEBSITE_ID, ideaId: IDEA_ID }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.inspection.state).toBe("no_obvious_match_in_current_crawl");
    expect(body.inspection.gscCopy).toMatch(/not available/);
  });

  it("rejects invalid ids without inspecting", async () => {
    const response = await POST(new Request("https://www.foundfy.me/inspect", { method: "POST" }), {
      params: Promise.resolve({ websiteId: "not-a-uuid", ideaId: IDEA_ID }),
    });
    expect(response.status).toBe(400);
    expect(inspectRelatedDemandForOwnerMock).not.toHaveBeenCalled();
  });

  it("keeps T0 when the body has no observation id and uses T1 when it does", async () => {
    inspectRelatedDemandForOwnerMock.mockResolvedValue({ state: "no_obvious_match_in_current_crawl" });
    inspectRelatedDemandAfterObservationForOwnerMock.mockResolvedValue({
      state: "no_obvious_match_after_targeted_observation",
    });

    await POST(new Request("https://www.foundfy.me/inspect", { method: "POST" }), {
      params: Promise.resolve({ websiteId: WEBSITE_ID, ideaId: IDEA_ID }),
    });
    expect(inspectRelatedDemandForOwnerMock).toHaveBeenCalledTimes(1);
    expect(inspectRelatedDemandAfterObservationForOwnerMock).not.toHaveBeenCalled();

    await POST(
      new Request("https://www.foundfy.me/inspect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetedObservationId: "obs-1" }),
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID, ideaId: IDEA_ID }) },
    );
    expect(inspectRelatedDemandAfterObservationForOwnerMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      ideaId: IDEA_ID,
      sessionToken: "owner-session",
      targetedObservationId: "obs-1",
    });
  });
});
