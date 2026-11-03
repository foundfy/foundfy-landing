import { describe, expect, it } from "vitest";
import { GOOGLE_ACCESS_EXPIRED_ERROR } from "./google-input";
import {
  emptyIndexingSnapshot,
  googleIndexingFromResponse,
  shouldCommitGoogleIndexingResponse,
} from "./indexing-input";
import { visibleGoogleIndexingForWebsite } from "./evaluate";

const WEBSITE_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const WEBSITE_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("Google indexing response mapping", () => {
  it("L. distinguishes missing owner session from expired Google OAuth", () => {
    expect(googleIndexingFromResponse(401, {})).toEqual({ kind: "no_session" });
    expect(googleIndexingFromResponse(401, { error: "Owner session required." })).toEqual({
      kind: "no_session",
    });
    expect(googleIndexingFromResponse(401, { error: GOOGLE_ACCESS_EXPIRED_ERROR })).toEqual({
      kind: "expired",
    });
    expect(googleIndexingFromResponse(403, {})).toEqual({ kind: "not_connected" });
  });

  it("M. maps quota, 5xx, and network failures to unavailable", () => {
    expect(googleIndexingFromResponse(502, { code: "quota" })).toEqual({
      kind: "unavailable",
      code: "quota",
    });
    expect(googleIndexingFromResponse(502, { code: "unavailable" })).toEqual({
      kind: "unavailable",
      code: "unavailable",
    });
    expect(googleIndexingFromResponse(0, {})).toEqual({
      kind: "unavailable",
      code: "unavailable",
    });
  });

  it("N. does not commit or show website A indexing on website B", () => {
    expect(
      shouldCommitGoogleIndexingResponse({
        cancelled: false,
        requestedWebsiteId: WEBSITE_A,
        currentWebsiteId: WEBSITE_B,
        requestGeneration: 1,
        latestGeneration: 2,
      }),
    ).toBe(false);

    const stored = {
      websiteId: WEBSITE_A,
      evidence: { kind: "checked" as const, inspectedAt: "2026-11-02T12:00:00.000Z", reused: false, urls: [], sitemap: {
        crawledSitemapUrls: [],
        listedInSearchConsole: false,
        sitemaps: [],
        interpretation: "none_listed" as const,
      } },
      loadError: null,
    };
    const visibleB = visibleGoogleIndexingForWebsite(stored, WEBSITE_B);
    expect(visibleB.websiteId).toBe(WEBSITE_B);
    expect(visibleB.evidence).toEqual({ kind: "not_checked" });
    expect(visibleB.loadError).toBeNull();
    expect(emptyIndexingSnapshot(WEBSITE_B).evidence).toEqual({ kind: "not_checked" });
  });
});
