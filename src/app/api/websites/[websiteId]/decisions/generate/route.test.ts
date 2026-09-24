import { afterEach, describe, expect, it, vi } from "vitest";

const generateDecisionsForWebsiteMock = vi.fn();
const loadDecisionsForWebsiteMock = vi.fn();

vi.mock("@/lib/decisions/generate", () => ({
  generateDecisionsForWebsite: (...args: unknown[]) => generateDecisionsForWebsiteMock(...args),
}));

vi.mock("@/lib/decisions/load", () => ({
  loadDecisionsForWebsite: (...args: unknown[]) => loadDecisionsForWebsiteMock(...args),
}));

import { DecisionPrerequisiteError } from "@/lib/decisions/types";
import { ObserveAuthError } from "@/lib/gsc/types";
import { POST } from "./route";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/websites/[websiteId]/decisions/generate", () => {
  it("requires an owner session", async () => {
    generateDecisionsForWebsiteMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    const response = await POST(
      new Request("https://www.foundfy.me/generate", { method: "POST" }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(401);
    expect(generateDecisionsForWebsiteMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      sessionToken: null,
    });
  });

  it("returns 409 when a Goal is missing", async () => {
    generateDecisionsForWebsiteMock.mockRejectedValue(
      new DecisionPrerequisiteError(
        "missing_goal",
        "Tell Foundfy what should happen when the right people find this site before prioritizing actions.",
      ),
    );

    const response = await POST(
      new Request("https://www.foundfy.me/generate", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.reason).toBe("missing_goal");
    expect(payload.error).toContain("Tell Foundfy what should happen");
    expect(loadDecisionsForWebsiteMock).not.toHaveBeenCalled();
  });

  it("returns 409 when a Site Model is missing", async () => {
    generateDecisionsForWebsiteMock.mockRejectedValue(
      new DecisionPrerequisiteError(
        "missing_site_model",
        "Confirm how Foundfy understands this site before prioritizing actions.",
      ),
    );

    const response = await POST(
      new Request("https://www.foundfy.me/generate", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ reason: "missing_site_model" });
    expect(loadDecisionsForWebsiteMock).not.toHaveBeenCalled();
  });

  it("returns 409 when Google is not connected", async () => {
    generateDecisionsForWebsiteMock.mockRejectedValue(
      new DecisionPrerequisiteError(
        "google_not_connected",
        "Connect Google Search before Foundfy can combine search demand with website evidence.",
      ),
    );

    const response = await POST(
      new Request("https://www.foundfy.me/generate", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.reason).toBe("google_not_connected");
    expect(loadDecisionsForWebsiteMock).not.toHaveBeenCalled();
  });

  it("returns 409 when Search Console has never synced", async () => {
    generateDecisionsForWebsiteMock.mockRejectedValue(
      new DecisionPrerequisiteError(
        "missing_gsc_sync",
        "Sync Google search data before Foundfy can prioritize cross-signal actions.",
      ),
    );

    const response = await POST(
      new Request("https://www.foundfy.me/generate", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ reason: "missing_gsc_sync" });
    expect(loadDecisionsForWebsiteMock).not.toHaveBeenCalled();
  });

  it("returns the generated owner view", async () => {
    generateDecisionsForWebsiteMock.mockResolvedValue({ runId: "run-1", decisions: [] });
    loadDecisionsForWebsiteMock.mockResolvedValue({
      status: "empty",
      emptyReason: "empty_gsc_evidence",
      decisions: [],
    });

    const response = await POST(
      new Request("https://www.foundfy.me/generate", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/no-store/);
    expect(await response.json()).toMatchObject({ emptyReason: "empty_gsc_evidence" });
  });

  it("returns no_cross_signal_candidates after a completed empty ranking", async () => {
    generateDecisionsForWebsiteMock.mockResolvedValue({ runId: "run-1", decisions: [] });
    loadDecisionsForWebsiteMock.mockResolvedValue({
      status: "empty",
      emptyReason: "no_cross_signal_candidates",
      decisions: [],
      run: { id: "run-1" },
    });

    const response = await POST(
      new Request("https://www.foundfy.me/generate", {
        method: "POST",
        headers: { cookie: "foundfy_gsc_session=owner-token" },
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      emptyReason: "no_cross_signal_candidates",
      run: { id: "run-1" },
    });
  });
});
