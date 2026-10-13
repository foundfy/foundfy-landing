import { afterEach, describe, expect, it, vi } from "vitest";

const loadResearchForOwnerMock = vi.fn();
const startResearchForOwnerMock = vi.fn();
const recoverResearchForOwnerMock = vi.fn();

vi.mock("@/lib/research/load", () => ({
  loadResearchForOwner: (...args: unknown[]) => loadResearchForOwnerMock(...args),
}));

vi.mock("@/lib/research/start", () => ({
  startResearchForOwner: (...args: unknown[]) => startResearchForOwnerMock(...args),
}));

vi.mock("@/lib/research/recover", () => ({
  recoverResearchForOwner: (...args: unknown[]) => recoverResearchForOwnerMock(...args),
}));

import { ObserveAuthError } from "@/lib/gsc/types";
import { ResearchProviderError } from "@/lib/research/errors";
import { GET, POST } from "./route";

const WEBSITE_ID = "cb01711e-7945-4a88-9998-e78fec411509";

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/websites/[websiteId]/research", () => {
  it("requires an owner session for GET and POST", async () => {
    loadResearchForOwnerMock.mockRejectedValue(new ObserveAuthError(401, "Owner session required."));
    startResearchForOwnerMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    const getResponse = await GET(new Request("https://www.foundfy.me/research"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });
    const postResponse = await POST(
      new Request("https://www.foundfy.me/research", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
  });

  it("does not invoke startResearch on GET", async () => {
    loadResearchForOwnerMock.mockResolvedValue({ readiness: { gate: null }, run: null });
    await GET(new Request("https://www.foundfy.me/research"), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });
    expect(startResearchForOwnerMock).not.toHaveBeenCalled();
    expect(recoverResearchForOwnerMock).not.toHaveBeenCalled();
  });

  it("maps provider metadata failure to a provider-unavailable response, not invalid_country", async () => {
    startResearchForOwnerMock.mockRejectedValue(
      new ResearchProviderError("invalid_response", "DataForSEO task failed."),
    );
    const response = await POST(
      new Request("https://www.foundfy.me/research", {
        method: "POST",
        body: JSON.stringify({ countryKey: "US", languages: ["en"] }),
      }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body.code).toBe("invalid_response");
    expect(body.code).not.toBe("invalid_country");
    expect(body.error).toBe("Unable to research related demand right now.");
    expect(JSON.stringify(body)).not.toMatch(/DataForSEO|task failed|Unauthorized/i);
  });
});

