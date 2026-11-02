import { describe, expect, it } from "vitest";
import { OBSERVE_EXPIRED_COPY } from "@/lib/gsc/display";
import {
  GOOGLE_ACCESS_EXPIRED_ERROR,
  GOOGLE_OWNER_SESSION_REQUIRED_ERROR,
  googleAccessRecoveryCopyFromLoadError,
  googleInputFromResponse,
  googlePerformanceSnapshotFromResponse,
  googlePerformanceViewFromResponse,
  shouldCommitGooglePerformanceResponse,
  shouldRetryGooglePerformanceAttempt,
} from "./google-input";

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
        requestGeneration: 1,
        latestGeneration: 1,
      }),
    ).toBe(true);
    expect(
      shouldCommitGooglePerformanceResponse({
        cancelled: true,
        requestedWebsiteId: "website-a",
        currentWebsiteId: "website-b",
        requestGeneration: 1,
        latestGeneration: 2,
      }),
    ).toBe(false);
    expect(
      shouldCommitGooglePerformanceResponse({
        cancelled: false,
        requestedWebsiteId: "website-a",
        currentWebsiteId: "website-b",
        requestGeneration: 1,
        latestGeneration: 2,
      }),
    ).toBe(false);
  });

  it("does not let an earlier failed generation overwrite a later success", () => {
    expect(
      shouldCommitGooglePerformanceResponse({
        cancelled: false,
        requestedWebsiteId: "website-a",
        currentWebsiteId: "website-a",
        requestGeneration: 1,
        latestGeneration: 2,
      }),
    ).toBe(false);
    expect(
      shouldCommitGooglePerformanceResponse({
        cancelled: false,
        requestedWebsiteId: "website-a",
        currentWebsiteId: "website-a",
        requestGeneration: 2,
        latestGeneration: 2,
      }),
    ).toBe(true);
  });

  it("retries one transient network or 5xx failure and never retries 401 or 403", () => {
    expect(shouldRetryGooglePerformanceAttempt({ attempt: 0, status: null })).toBe(true);
    expect(shouldRetryGooglePerformanceAttempt({ attempt: 0, status: 500 })).toBe(true);
    expect(shouldRetryGooglePerformanceAttempt({ attempt: 1, status: 500 })).toBe(false);
    expect(shouldRetryGooglePerformanceAttempt({ attempt: 0, status: 401 })).toBe(false);
    expect(shouldRetryGooglePerformanceAttempt({ attempt: 0, status: 403 })).toBe(false);
    expect(shouldRetryGooglePerformanceAttempt({ attempt: 0, status: 404 })).toBe(false);
    expect(shouldRetryGooglePerformanceAttempt({ attempt: 0, status: 200 })).toBe(false);
  });

  it("keeps a completed empty 200 body in the shared snapshot view", () => {
    const payload = {
      status: "completed",
      empty: true,
      windowDays: 28,
      syncedAt: "2026-10-31T12:00:00.000Z",
    };
    const snapshot = googlePerformanceSnapshotFromResponse({
      websiteId: "website-a",
      status: 200,
      payload,
    });

    expect(snapshot.evidence).toEqual({ kind: "empty", windowDays: 28 });
    expect(snapshot.view).toEqual(payload);
    expect(snapshot.loadError).toBeNull();
    expect(googlePerformanceViewFromResponse(500, payload)).toBeNull();
    expect(googlePerformanceViewFromResponse(401, payload)).toBeNull();
  });

  it("keeps missing owner session distinct from expired Google access", () => {
    expect(GOOGLE_ACCESS_EXPIRED_ERROR).toBe(OBSERVE_EXPIRED_COPY);

    const missingSession = googlePerformanceSnapshotFromResponse({
      websiteId: "website-a",
      status: 401,
      payload: { error: GOOGLE_OWNER_SESSION_REQUIRED_ERROR },
    });
    const expiredAccess = googlePerformanceSnapshotFromResponse({
      websiteId: "website-a",
      status: 401,
      payload: { error: GOOGLE_ACCESS_EXPIRED_ERROR },
    });

    expect(missingSession.evidence).toEqual({ kind: "no_session" });
    expect(missingSession.view).toBeNull();
    expect(missingSession.loadError).toBe(GOOGLE_OWNER_SESSION_REQUIRED_ERROR);
    expect(googleAccessRecoveryCopyFromLoadError(missingSession.loadError)).toBeNull();

    expect(expiredAccess.evidence).toEqual({ kind: "no_session" });
    expect(expiredAccess.view).toBeNull();
    expect(expiredAccess.loadError).toBe(OBSERVE_EXPIRED_COPY);
    expect(googleAccessRecoveryCopyFromLoadError(expiredAccess.loadError)).toBe(
      OBSERVE_EXPIRED_COPY,
    );
  });
});
