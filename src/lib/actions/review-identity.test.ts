import { describe, expect, it } from "vitest";
import {
  canonicalObservationRefs,
  resolveCanonicalReviewIdentity,
  reviewCurrencyForIdentity,
  latestReviewForIdentity,
} from "./review-identity";
import type { CanonicalReviewIdentity, CanonicalReviewRecord } from "./review-types";

const GSC_URL = "https://www.dbhobby.com/es/pintura-en-seda";
const PAGE_URL = "https://www.dbhobby.com/es";
const CANONICAL_URL = "https://www.dbhobby.com/es/pintura-en-seda";

function review(overrides: Partial<CanonicalReviewRecord> = {}): CanonicalReviewRecord {
  return {
    id: "review-1",
    websiteId: "website-1",
    reviewType: "review_canonical_target",
    outcome: "intentional",
    ownerId: "owner-1",
    reviewedAt: "2026-10-08T00:00:00.000Z",
    decisionId: "decision-1",
    decisionRunId: "run-1",
    observationId: "obs-es",
    pageId: "page-es",
    crawlRunId: "crawl-1",
    gscSyncId: "sync-1",
    siteModelId: "site-model-1",
    goalId: "goal-1",
    requestedUrl: PAGE_URL,
    finalUrl: PAGE_URL,
    canonicalUrl: CANONICAL_URL,
    pageUrl: PAGE_URL,
    createdAt: "2026-10-08T00:00:00.000Z",
    evidenceRefs: [],
    ...overrides,
  };
}

function live(overrides: Partial<CanonicalReviewIdentity> = {}): CanonicalReviewIdentity {
  return {
    observationId: "obs-es",
    pageId: "page-es",
    crawlRunId: "crawl-1",
    pageUrl: PAGE_URL,
    requestedUrl: PAGE_URL,
    finalUrl: PAGE_URL,
    canonicalUrl: CANONICAL_URL,
    ...overrides,
  };
}

describe("canonical review identity", () => {
  it("resolves the observation page, not the Decision/GSC URL", () => {
    const identity = resolveCanonicalReviewIdentity({
      observation: {
        id: "obs-es",
        pageId: "page-es",
        pageUrl: PAGE_URL,
        crawlRunId: "crawl-1",
        ruleKey: "indexability.canonical_points_elsewhere",
        status: "active",
        evidence: {
          requestedUrl: PAGE_URL,
          finalUrl: PAGE_URL,
          canonical: CANONICAL_URL,
        },
      },
      page: {
        id: "page-es",
        crawlRunId: "crawl-1",
        requestedUrl: PAGE_URL,
        finalUrl: PAGE_URL,
        canonical: CANONICAL_URL,
      },
    });

    expect(identity).toEqual({
      observationId: "obs-es",
      pageId: "page-es",
      crawlRunId: "crawl-1",
      pageUrl: PAGE_URL,
      requestedUrl: PAGE_URL,
      finalUrl: PAGE_URL,
      canonicalUrl: CANONICAL_URL,
    });
    expect(identity?.pageUrl).not.toBe(GSC_URL);
    expect(identity?.pageUrl).not.toContain("pintura-en-seda");
    expect(identity?.canonicalUrl).toBe(CANONICAL_URL);
  });

  it("still reviews /es → /es/pintura-en-seda after Decision identity uses the crawl page", () => {
    const identity = resolveCanonicalReviewIdentity({
      observation: {
        id: "obs-es",
        pageId: "page-es",
        pageUrl: PAGE_URL,
        crawlRunId: "crawl-1",
        ruleKey: "indexability.canonical_points_elsewhere",
        status: "active",
        evidence: {
          requestedUrl: PAGE_URL,
          finalUrl: PAGE_URL,
          canonical: CANONICAL_URL,
        },
      },
      page: {
        id: "page-es",
        crawlRunId: "crawl-1",
        requestedUrl: PAGE_URL,
        finalUrl: PAGE_URL,
        canonical: CANONICAL_URL,
      },
    });

    expect(identity?.pageUrl).toBe(PAGE_URL);
    expect(identity?.canonicalUrl).toBe(CANONICAL_URL);
    expect(canonicalObservationRefs({
      evidenceRefs: [
        {
          kind: "gsc_evidence",
          recordId: "gsc-1",
          snapshot: { pageUrl: GSC_URL, impressions: 212, clicks: 29 },
        },
        {
          kind: "observation",
          recordId: "obs-es",
          snapshot: { ruleKey: "indexability.canonical_points_elsewhere", pageUrl: PAGE_URL },
        },
      ],
    })).toHaveLength(1);
  });

  it("ignores a misleading Decision pageUrl when selecting observation refs", () => {
    const refs = canonicalObservationRefs({
      evidenceRefs: [
        {
          kind: "gsc_evidence",
          recordId: "gsc-1",
          snapshot: { pageUrl: GSC_URL },
        },
        {
          kind: "observation",
          recordId: "obs-es",
          snapshot: { ruleKey: "indexability.canonical_points_elsewhere" },
        },
      ],
    });

    expect(refs).toEqual([{ recordId: "obs-es", snapshot: { ruleKey: "indexability.canonical_points_elsewhere" } }]);
  });

  it("keeps a review current when later crawls observe the same relationship", () => {
    const laterCrawl = live({ observationId: "obs-later", crawlRunId: "crawl-later" });
    const stored = review();

    expect(reviewCurrencyForIdentity(stored, laterCrawl)).toBe("current");
    expect(reviewCurrencyForIdentity(stored, live({ crawlRunId: "crawl-2" }))).toBe("current");
    expect(reviewCurrencyForIdentity(stored, live({ observationId: "obs-new" }))).toBe("current");
    expect(stored.crawlRunId).toBe("crawl-1");
    expect(stored.observationId).toBe("obs-es");
    expect(latestReviewForIdentity([stored], laterCrawl, "decision-new")).toEqual(stored);
  });

  it("marks a review stale when the canonical relationship changes", () => {
    const stored = review();

    expect(
      reviewCurrencyForIdentity(
        stored,
        live({ canonicalUrl: "https://www.dbhobby.com/ca/pintura-en-seda" }),
      ),
    ).toBe("stale");
    expect(reviewCurrencyForIdentity(stored, null)).toBe("stale");
    expect(
      reviewCurrencyForIdentity(
        stored,
        live({
          pageUrl: "https://www.dbhobby.com/en",
          requestedUrl: "https://www.dbhobby.com/en",
          finalUrl: "https://www.dbhobby.com/en",
        }),
      ),
    ).toBe("stale");
    expect(stored.crawlRunId).toBe("crawl-1");
    expect(stored.observationId).toBe("obs-es");
    expect(stored.canonicalUrl).toBe(CANONICAL_URL);
  });
});
