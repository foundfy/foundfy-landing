import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  OBSERVE_EVIDENCE_EMPTY_COPY,
  OBSERVE_EXPIRED_COPY,
  OBSERVE_SYNC_HELP,
} from "@/lib/gsc/display";
import { GOOGLE_INDEXING_UNKNOWN, buildFirstValueView } from "@/lib/site/first-value";
import type { WebsiteOverview } from "@/lib/websites/types";
import { buildTechnicalFoundationsView } from "./display";
import {
  evaluateGooglePerformance,
  googleIndexingCheck,
  visibleGoogleEvidenceForWebsite,
} from "./evaluate";
import {
  GOOGLE_ACCESS_EXPIRED_ERROR,
  GOOGLE_OWNER_SESSION_REQUIRED_ERROR,
  googleAccessRecoveryCopyFromLoadError,
  googleInputFromResponse,
  googlePerformanceSnapshotFromResponse,
  shouldCommitGooglePerformanceResponse,
  shouldRetryGooglePerformanceAttempt,
} from "./google-input";

const WEBSITE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const WEBSITE_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const EMPTY_COMPLETED = {
  status: "completed",
  empty: true,
  windowDays: 28,
  syncedAt: "2026-10-31T12:00:00.000Z",
  summary: { queriesReported: 0, clicks: 0, impressions: 0, pagesSeen: 0 },
};

function read(relativePath: string): string {
  return readFileSync(path.join(__dirname, relativePath), "utf8");
}

function websiteOverview(websiteId: string, hostname: string): WebsiteOverview {
  return {
    website: {
      id: websiteId,
      hostname,
      displayUrl: `https://${hostname}/`,
      firstSeenAt: "2026-10-31T00:00:00.000Z",
      lastCrawledAt: null,
    },
    latestUsableScan: null,
    highlightedFindings: [],
    siteModel: null,
    goals: null,
    activeScan: null,
    scanHistory: [],
  };
}

describe("shared Google performance snapshot", () => {
  it("A. shares a completed empty sync across First Value, Foundations, and Google Search", () => {
    const snapshot = googlePerformanceSnapshotFromResponse({
      websiteId: WEBSITE_A,
      status: 200,
      payload: EMPTY_COMPLETED,
    });
    const visible = visibleGoogleEvidenceForWebsite(snapshot, WEBSITE_A);
    const firstValue = buildFirstValueView(websiteOverview(WEBSITE_A, "a.example"), visible.evidence);
    const foundations = buildTechnicalFoundationsView(null, visible.evidence);
    const observeView = visible.view as typeof EMPTY_COMPLETED;

    expect(visible.evidence).toEqual({ kind: "empty", windowDays: 28 });
    expect(firstValue.unknownBody).toMatch(/synced, but reported no queries/i);
    expect(firstValue.unknownBody).not.toMatch(/could not load Google search analytics/i);
    expect(foundations.checks.find((check) => check.id === "google_performance")?.summary).toMatch(
      /synced, but reported no queries/i,
    );
    expect(observeView.status).toBe("completed");
    expect(observeView.empty).toBe(true);
    expect(observeView.syncedAt).toBe("2026-10-31T12:00:00.000Z");
    expect(OBSERVE_EVIDENCE_EMPTY_COPY).toMatch(/empty completed sync is not an indexing check/i);
    expect(firstValue.unknownBody).toContain(GOOGLE_INDEXING_UNKNOWN);
  });

  it("B. recovers from one transient failure into the shared empty snapshot", () => {
    expect(shouldRetryGooglePerformanceAttempt({ attempt: 0, status: 503 })).toBe(true);
    expect(shouldRetryGooglePerformanceAttempt({ attempt: 0, status: null })).toBe(true);

    const failed = googlePerformanceSnapshotFromResponse({
      websiteId: WEBSITE_A,
      status: 503,
      payload: {},
    });
    expect(failed.evidence).toEqual({ kind: "unavailable" });
    expect(failed.view).toBeNull();

    const recovered = googlePerformanceSnapshotFromResponse({
      websiteId: WEBSITE_A,
      status: 200,
      payload: EMPTY_COMPLETED,
    });
    expect(shouldRetryGooglePerformanceAttempt({ attempt: 1, status: 200 })).toBe(false);
    expect(recovered.evidence?.kind).toBe("empty");
    expect((recovered.view as typeof EMPTY_COMPLETED).empty).toBe(true);
    expect(buildFirstValueView(websiteOverview(WEBSITE_A, "a.example"), recovered.evidence).unknownBody).not.toMatch(
      /could not load Google search analytics/i,
    );
  });

  it("C. does not let a late failed response overwrite a later successful snapshot", () => {
    const success = googlePerformanceSnapshotFromResponse({
      websiteId: WEBSITE_A,
      status: 200,
      payload: EMPTY_COMPLETED,
    });
    const lateFailure = googleInputFromResponse(500, {});

    expect(
      shouldCommitGooglePerformanceResponse({
        cancelled: false,
        requestedWebsiteId: WEBSITE_A,
        currentWebsiteId: WEBSITE_A,
        requestGeneration: 1,
        latestGeneration: 2,
      }),
    ).toBe(false);
    expect(
      shouldCommitGooglePerformanceResponse({
        cancelled: false,
        requestedWebsiteId: WEBSITE_A,
        currentWebsiteId: WEBSITE_A,
        requestGeneration: 2,
        latestGeneration: 2,
      }),
    ).toBe(true);
    expect(success.evidence?.kind).toBe("empty");
    expect(lateFailure).toEqual({ kind: "unavailable" });
  });

  it("D. isolates website A authorized evidence from website B unauthorized on first render", () => {
    const authorizedA = googlePerformanceSnapshotFromResponse({
      websiteId: WEBSITE_A,
      status: 200,
      payload: EMPTY_COMPLETED,
    });
    const firstRenderForB = visibleGoogleEvidenceForWebsite(authorizedA, WEBSITE_B);
    const unauthorizedB = googleInputFromResponse(401, {});

    expect(firstRenderForB.websiteId).toBe(WEBSITE_B);
    expect(firstRenderForB.evidence).toBeNull();
    expect(firstRenderForB.view).toBeNull();
    expect(buildFirstValueView(websiteOverview(WEBSITE_B, "b.example"), firstRenderForB.evidence).unknownBody).not.toMatch(
      /synced, but reported no queries/i,
    );
    expect(unauthorizedB).toEqual({ kind: "no_session" });
    expect(buildFirstValueView(websiteOverview(WEBSITE_B, "b.example"), unauthorizedB).unknownBody).toMatch(
      /unavailable in this view/i,
    );
  });

  it("E. preserves 401 and 403 mapping and does not retry them", () => {
    expect(googleInputFromResponse(401, {})).toEqual({ kind: "no_session" });
    expect(googleInputFromResponse(403, {})).toEqual({ kind: "not_connected" });
    expect(shouldRetryGooglePerformanceAttempt({ attempt: 0, status: 401 })).toBe(false);
    expect(shouldRetryGooglePerformanceAttempt({ attempt: 0, status: 403 })).toBe(false);
    expect(googlePerformanceSnapshotFromResponse({ websiteId: WEBSITE_A, status: 401, payload: {} }).view).toBeNull();
    expect(googlePerformanceSnapshotFromResponse({ websiteId: WEBSITE_A, status: 403, payload: {} }).view).toBeNull();
  });

  it("does not infer OAuth expiry from a missing-session 401 after Observe is connected", () => {
    const missingSession = googlePerformanceSnapshotFromResponse({
      websiteId: WEBSITE_A,
      status: 401,
      payload: { error: GOOGLE_OWNER_SESSION_REQUIRED_ERROR },
    });
    const expiredAccess = googlePerformanceSnapshotFromResponse({
      websiteId: WEBSITE_A,
      status: 401,
      payload: { error: GOOGLE_ACCESS_EXPIRED_ERROR },
    });
    const firstValueMissing = buildFirstValueView(
      websiteOverview(WEBSITE_A, "a.example"),
      missingSession.evidence,
    );
    const observe = read("../../components/site/SiteObserveSection.tsx");

    expect(missingSession.evidence?.kind).toBe("no_session");
    expect(missingSession.view).toBeNull();
    expect(googleAccessRecoveryCopyFromLoadError(missingSession.loadError)).toBeNull();
    expect(firstValueMissing.unknownBody).toMatch(/unavailable in this view/i);
    expect(firstValueMissing.unknownBody).not.toMatch(/Google access expired/i);
    expect(firstValueMissing.unknownBody).not.toMatch(/Search Console is not connected/i);

    expect(expiredAccess.view).toBeNull();
    expect(googleAccessRecoveryCopyFromLoadError(expiredAccess.loadError)).toBe(OBSERVE_EXPIRED_COPY);
    expect(observe).toContain("performanceLoadError === OBSERVE_EXPIRED_COPY");
    expect(observe).toContain("setActionError(OBSERVE_EXPIRED_COPY)");
  });

  it("F. keeps private GSC data off the public overview", () => {
    const overviewLoader = read("../websites/load-overview.ts");
    const publicRoute = read("../../app/api/websites/[websiteId]/route.ts");
    const overviewTypes = read("../websites/types.ts");

    expect(overviewLoader).not.toMatch(/search-analytics|loadSearchAnalyticsEvidence|from \"@\/lib\/gsc/);
    expect(publicRoute).not.toMatch(/from \"@\/lib\/gsc|search-analytics/);
    expect(overviewTypes).not.toMatch(/SearchAnalyticsView|query_text|impressions/);
  });

  it("G. refreshes the common snapshot after manual sync without claiming indexing", () => {
    const observe = read("../../components/site/SiteObserveSection.tsx");
    const syncBlock = observe.slice(
      observe.indexOf("const syncEvidence"),
      observe.indexOf("const applyPresenceView"),
    );

    expect(syncBlock).toContain("observe/search-analytics/sync");
    expect(syncBlock).toContain("onReloadPerformance?.()");
    expect(syncBlock).not.toMatch(/setEvidence\(payload\)/);
    expect(OBSERVE_SYNC_HELP).toMatch(/does not ask Google to index/i);
    expect(googleIndexingCheck().status).toBe("not_checked");
    expect(
      evaluateGooglePerformance({ kind: "empty", windowDays: 28 }).detail,
    ).toMatch(/not an indexing check/i);
  });

  it("H. does not trigger a second performance GET from Observe mounting", () => {
    const hook = read("../../hooks/useGooglePerformanceEvidence.ts");
    const observe = read("../../components/site/SiteObserveSection.tsx");
    const page = read("../../components/site/SitePageView.tsx");

    expect(hook).toContain("/api/websites/${requestedWebsiteId}/observe/search-analytics");
    expect(hook).toContain("cache: \"no-store\"");
    expect(hook).not.toMatch(/setInterval|setTimeout/);
    expect(observe).toContain("/api/websites/${websiteId}/observe");
    expect(observe).not.toMatch(/\/observe\/search-analytics`/);
    expect(observe).toContain("observe/search-analytics/sync");
    expect(page).toContain("useGooglePerformanceEvidence(websiteId)");
    expect(page).toContain("onReloadPerformance={reloadGooglePerformance}");
    expect(page.match(/useGooglePerformanceEvidence\(/g)?.length).toBe(1);

    const indexingHook = read("../../hooks/useGoogleIndexingEvidence.ts");
    expect(indexingHook).toContain("/api/websites/${requestedWebsiteId}/observe/indexing/check");
    expect(indexingHook).toContain('method: "POST"');
    expect(
      indexingHook.slice(indexingHook.indexOf("useEffect"), indexingHook.indexOf("const check")),
    ).not.toMatch(/fetch|indexing\/check/);
    expect(page).toContain("useGoogleIndexingEvidence(websiteId)");
    expect(page.match(/useGoogleIndexingEvidence\(/g)?.length).toBe(1);
  });

  it("I. keeps Google indexing Not checked after a shared empty snapshot", () => {
    const snapshot = googlePerformanceSnapshotFromResponse({
      websiteId: WEBSITE_A,
      status: 200,
      payload: EMPTY_COMPLETED,
    });
    const foundations = buildTechnicalFoundationsView(null, snapshot.evidence);
    const firstValue = buildFirstValueView(websiteOverview(WEBSITE_A, "a.example"), snapshot.evidence);

    expect(googleIndexingCheck().status).toBe("not_checked");
    expect(foundations.checks.find((check) => check.id === "google_indexing")?.status).toBe(
      "not_checked",
    );
    expect(firstValue.unknownBody).toContain(GOOGLE_INDEXING_UNKNOWN);
  });
});
