import { afterEach, describe, expect, it, vi } from "vitest";

const checkGoogleIndexingMock = vi.fn();

vi.mock("@/lib/gsc/indexing-check", () => ({
  checkGoogleIndexing: (...args: unknown[]) => checkGoogleIndexingMock(...args),
}));

import {
  GoogleAuthExpiredError,
  GoogleIndexingError,
  GoogleIndexingPilotError,
  ObserveAuthError,
  SearchConsoleNotConnectedError,
} from "@/lib/gsc/types";
import { POST } from "./route";

const WEBSITE_ID = "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2";

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/websites/[websiteId]/observe/indexing/check", () => {
  it("O. requires an owner session and does not inspect without one", async () => {
    checkGoogleIndexingMock.mockRejectedValue(
      new ObserveAuthError(401, "Owner session required."),
    );

    const response = await POST(new Request("https://www.foundfy.me/indexing/check", { method: "POST" }), {
      params: Promise.resolve({ websiteId: WEBSITE_ID }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Owner session required." });
    expect(checkGoogleIndexingMock).toHaveBeenCalledWith({
      websiteId: WEBSITE_ID,
      sessionToken: null,
    });
  });

  it("L. keeps 403 not-connected and expired Google access distinct", async () => {
    checkGoogleIndexingMock.mockRejectedValueOnce(new SearchConsoleNotConnectedError());
    const forbidden = await POST(
      new Request("https://www.foundfy.me/indexing/check", { method: "POST" }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ error: "Search Console is not connected." });

    checkGoogleIndexingMock.mockRejectedValueOnce(new GoogleIndexingPilotError());
    const ineligible = await POST(
      new Request("https://www.foundfy.me/indexing/check", { method: "POST" }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );
    expect(ineligible.status).toBe(403);
    expect(await ineligible.json()).toEqual({
      error: "Google indexing observation is not available for this site yet.",
      code: "pilot_ineligible",
    });

    checkGoogleIndexingMock.mockRejectedValueOnce(new GoogleAuthExpiredError());
    const expired = await POST(
      new Request("https://www.foundfy.me/indexing/check", { method: "POST" }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );
    expect(expired.status).toBe(401);
    expect(await expired.json()).toEqual({
      error: "Google access expired. Connect Google again.",
    });
  });

  it("M. returns 502 with the Google indexing error code", async () => {
    checkGoogleIndexingMock.mockRejectedValue(new GoogleIndexingError("quota"));
    const response = await POST(
      new Request("https://www.foundfy.me/indexing/check", { method: "POST" }),
      { params: Promise.resolve({ websiteId: WEBSITE_ID }) },
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Google indexing data couldn't be loaded right now.",
      code: "quota",
    });
  });
});
