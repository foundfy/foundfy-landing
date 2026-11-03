import { describe, expect, it } from "vitest";
import {
  evaluateGooglePerformance,
  visibleGoogleEvidenceForWebsite,
  visibleGoogleIndexingForWebsite,
} from "./evaluate";
import {
  googleInputFromResponse,
  shouldCommitGooglePerformanceResponse,
} from "./google-input";
import { buildFirstValueView } from "@/lib/site/first-value";
import type { WebsiteOverview } from "@/lib/websites/types";

const WEBSITE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const WEBSITE_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const ownerReportedA = {
  websiteId: WEBSITE_A,
  evidence: {
    kind: "reported" as const,
    windowDays: 28,
    queriesReported: 12,
  },
  view: {
    status: "completed",
    empty: false,
    summary: { queriesReported: 12 },
  },
  loadError: null,
};

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

describe("Google evidence isolation on website A → website B navigation", () => {
  it("does not render website A evidence on the first render for B, before effects or responses", () => {
    const firstRenderForB = visibleGoogleEvidenceForWebsite(ownerReportedA, WEBSITE_B);

    expect(firstRenderForB.websiteId).toBe(WEBSITE_B);
    expect(firstRenderForB.evidence).toBeNull();
    expect(firstRenderForB.view).toBeNull();
    expect(firstRenderForB.loadError).toBeNull();
    expect(firstRenderForB.evidence).not.toEqual(ownerReportedA.evidence);

    const view = buildFirstValueView(
      websiteOverview(WEBSITE_B, "b.example"),
      firstRenderForB.evidence,
    );
    const blob = [view.unknownBody, view.nextStep.message, view.ownerNeed.message].join(" ");
    expect(blob).not.toMatch(/Google reported search performance|12 queries/i);
    expect(blob).not.toMatch(/disconnected/i);
    expect(view.nextStep.code).toBe("no_scan");
  });

  it("discards a late website A response after navigation to unauthorized B", () => {
    expect(
      shouldCommitGooglePerformanceResponse({
        cancelled: true,
        requestedWebsiteId: WEBSITE_A,
        currentWebsiteId: WEBSITE_B,
        requestGeneration: 1,
        latestGeneration: 2,
      }),
    ).toBe(false);
    expect(
      shouldCommitGooglePerformanceResponse({
        cancelled: false,
        requestedWebsiteId: WEBSITE_A,
        currentWebsiteId: WEBSITE_B,
        requestGeneration: 1,
        latestGeneration: 2,
      }),
    ).toBe(false);

    const lateA = googleInputFromResponse(200, {
      status: "completed",
      empty: false,
      windowDays: 28,
      summary: { queriesReported: 12 },
    });
    const unauthorizedB = googleInputFromResponse(401, {});
    expect(lateA).toEqual({ kind: "reported", windowDays: 28, queriesReported: 12 });
    expect(unauthorizedB).toEqual({ kind: "no_session" });

    const afterLateA = visibleGoogleEvidenceForWebsite(
      {
        websiteId: WEBSITE_A,
        evidence: lateA,
        view: { empty: false, summary: { queriesReported: 12 } },
        loadError: null,
      },
      WEBSITE_B,
    );
    expect(afterLateA.evidence).toBeNull();
    expect(afterLateA.view).toBeNull();
    expect(evaluateGooglePerformance(afterLateA.evidence).summary).not.toMatch(
      /Google reported search performance|12 queries/i,
    );

    const bView = buildFirstValueView(
      websiteOverview(WEBSITE_B, "b.example"),
      unauthorizedB,
    );
    expect(bView.nextStep.code).toBe("no_scan");
    expect(bView.unknownBody).toMatch(/unavailable in this view/i);
    expect(bView.unknownBody).not.toMatch(/disconnected|reported search performance|12 queries/i);
    expect(unauthorizedB.kind).toBe("no_session");
  });

  it("still shows website A evidence only under website A", () => {
    const visibleA = visibleGoogleEvidenceForWebsite(ownerReportedA, WEBSITE_A);
    expect(visibleA.evidence).toEqual(ownerReportedA.evidence);
    expect(evaluateGooglePerformance(visibleA.evidence).summary).toMatch(
      /Google reported search performance/i,
    );
  });

  it("does not reuse website A Google indexing evidence on website B", () => {
    const storedA = {
      websiteId: WEBSITE_A,
      evidence: {
        kind: "checked" as const,
        inspectedAt: "2026-11-02T23:00:00.000Z",
        reused: false,
        urls: [
          {
            url: "https://a.example/",
            role: "homepage" as const,
            verdict: "indexed" as const,
            coverageState: "Submitted and indexed",
            indexingState: "INDEXING_ALLOWED",
            robotsTxtState: null,
            pageFetchState: null,
            lastCrawlTime: null,
            inspectedAt: "2026-11-02T23:00:00.000Z",
            userCanonical: null,
            googleCanonical: null,
            canonicalMismatch: false,
            referringUrls: [],
            sitemaps: [],
            reason: "Submitted and indexed",
          },
        ],
        sitemap: {
          crawledSitemapUrls: [],
          listedInSearchConsole: false,
          sitemaps: [],
          interpretation: "none_listed" as const,
        },
      },
      loadError: null,
    };

    const firstRenderForB = visibleGoogleIndexingForWebsite(storedA, WEBSITE_B);
    expect(firstRenderForB.websiteId).toBe(WEBSITE_B);
    expect(firstRenderForB.evidence).toEqual({ kind: "not_checked" });
    expect(firstRenderForB.loadError).toBeNull();
    expect(buildFirstValueView(websiteOverview(WEBSITE_B, "b.example"), null, firstRenderForB.evidence).unknownBody).not.toMatch(
      /homepage as indexed/i,
    );
  });
});
