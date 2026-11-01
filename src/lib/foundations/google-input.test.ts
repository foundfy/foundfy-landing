import { describe, expect, it } from "vitest";
import { googleInputFromResponse, shouldCommitGooglePerformanceResponse } from "./google-input";

describe("googleInputFromResponse", () => {
  it("maps owner-session HTTP states without treating not_synced as empty", () => {
    expect(googleInputFromResponse(401, {})).toEqual({ kind: "no_session" });
    expect(googleInputFromResponse(403, {})).toEqual({ kind: "not_connected" });
    expect(googleInputFromResponse(500, {})).toEqual({ kind: "unavailable" });
    expect(
      googleInputFromResponse(200, { status: "not_synced", empty: true, windowDays: 28 }),
    ).toEqual({ kind: "not_synced" });
    expect(
      googleInputFromResponse(200, { status: "completed", empty: true, windowDays: 28 }),
    ).toEqual({ kind: "empty", windowDays: 28 });
    expect(
      googleInputFromResponse(200, {
        status: "completed",
        empty: false,
        windowDays: 28,
        summary: { queriesReported: 4 },
      }),
    ).toEqual({ kind: "reported", windowDays: 28, queriesReported: 4 });
  });

  it("does not commit a late website A response after navigation to B", () => {
    expect(
      shouldCommitGooglePerformanceResponse({
        cancelled: false,
        requestedWebsiteId: "website-a",
        currentWebsiteId: "website-a",
      }),
    ).toBe(true);
    expect(
      shouldCommitGooglePerformanceResponse({
        cancelled: true,
        requestedWebsiteId: "website-a",
        currentWebsiteId: "website-b",
      }),
    ).toBe(false);
    expect(
      shouldCommitGooglePerformanceResponse({
        cancelled: false,
        requestedWebsiteId: "website-a",
        currentWebsiteId: "website-b",
      }),
    ).toBe(false);
  });
});
