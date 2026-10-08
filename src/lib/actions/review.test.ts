import { beforeEach, describe, expect, it, vi } from "vitest";

const requireObserveOwnerMock = vi.fn();
const findDecisionByIdMock = vi.fn();
const findDecisionRunByIdMock = vi.fn();
const findLatestCompletedDecisionRunMock = vi.fn();
const listDecisionsForRunMock = vi.fn();
const findCanonicalReviewObservationMock = vi.fn();
const findCanonicalReviewPageMock = vi.fn();
const insertCanonicalReviewMock = vi.fn();
const listCanonicalReviewsForWebsiteMock = vi.fn();

vi.mock("@/lib/gsc/observe", () => ({
  requireObserveOwner: (...args: unknown[]) => requireObserveOwnerMock(...args),
}));

vi.mock("@/lib/decisions/db", () => ({
  findDecisionById: (...args: unknown[]) => findDecisionByIdMock(...args),
  findDecisionRunById: (...args: unknown[]) => findDecisionRunByIdMock(...args),
  findLatestCompletedDecisionRun: (...args: unknown[]) => findLatestCompletedDecisionRunMock(...args),
  listDecisionsForRun: (...args: unknown[]) => listDecisionsForRunMock(...args),
}));

vi.mock("./review-db", () => ({
  findCanonicalReviewObservation: (...args: unknown[]) => findCanonicalReviewObservationMock(...args),
  findCanonicalReviewPage: (...args: unknown[]) => findCanonicalReviewPageMock(...args),
  insertCanonicalReview: (...args: unknown[]) => insertCanonicalReviewMock(...args),
  listCanonicalReviewsForWebsite: (...args: unknown[]) => listCanonicalReviewsForWebsiteMock(...args),
}));

import { ObserveAuthError } from "@/lib/gsc/types";
import { listCanonicalReviewsForOwner, submitCanonicalReview } from "./review";

const WEBSITE_ID = "388c5109-fa75-4ba7-af55-f7c95a69122b";
const SESSION = "owner-token";
const PAGE_URL = "https://www.dbhobby.com/es";
const CANONICAL_URL = "https://www.dbhobby.com/es/pintura-en-seda";
const GSC_URL = "https://www.dbhobby.com/es/pintura-en-seda";

function elsewhereDecision() {
  return {
    id: "decision-1",
    decisionRunId: "run-1",
    websiteId: WEBSITE_ID,
    decisionType: "existing_demand_page_issue",
    title: "Review the canonical URL on /es/pintura-en-seda",
    explanation: "Google may treat another URL as the preferred version of this page.",
    pageUrl: GSC_URL,
    pageId: "page-es",
    priorityBand: "do_first",
    rank: 2,
    scoring: { issueImportance: 55, searchDemand: 100, evidenceConfidence: 90, total: 78 },
    confidence: "exact_match",
    createdAt: "2026-10-08T00:00:00.000Z",
    evidenceRefs: [
      {
        kind: "observation",
        recordId: "obs-es",
        snapshot: { ruleKey: "indexability.canonical_points_elsewhere" },
      },
      {
        kind: "gsc_evidence",
        recordId: "gsc-1",
        snapshot: { pageUrl: GSC_URL, impressions: 212, clicks: 29 },
      },
    ],
  };
}

function missingCanonicalDecision() {
  return {
    ...elsewhereDecision(),
    id: "decision-missing",
    title: "Add a canonical URL on /ca/pintures-arasilk-per-la-seda",
    evidenceRefs: [
      {
        kind: "observation",
        recordId: "obs-missing",
        snapshot: { ruleKey: "indexability.canonical_missing" },
      },
    ],
  };
}

function decisionRun() {
  return {
    id: "run-1",
    websiteId: WEBSITE_ID,
    siteModelId: "site-model-1",
    crawlRunId: "crawl-1",
    gscSearchSyncId: "sync-1",
    engineVersion: "decision_v1",
    status: "completed",
    goalId: "goal-1",
    goalSnapshot: {
      id: "goal-1",
      primaryType: "grow_signups",
      secondaryType: null,
      note: null,
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
    gscTruncated: false,
    errorCode: null,
    createdAt: "2026-10-08T00:00:00.000Z",
    completedAt: "2026-10-08T00:00:01.000Z",
  };
}

function storedReview(outcome: "intentional" | "needs_change" | "unsure") {
  return {
    id: `review-${outcome}`,
    websiteId: WEBSITE_ID,
    reviewType: "review_canonical_target",
    outcome,
    ownerId: "owner-1",
    reviewedAt: "2026-10-08T12:00:00.000Z",
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
    createdAt: "2026-10-08T12:00:00.000Z",
    evidenceRefs: [],
  };
}

describe("canonical review-only workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireObserveOwnerMock.mockResolvedValue({ owner: { id: "owner-1" } });
    findDecisionByIdMock.mockResolvedValue(elsewhereDecision());
    findDecisionRunByIdMock.mockResolvedValue(decisionRun());
    findLatestCompletedDecisionRunMock.mockResolvedValue(decisionRun());
    listDecisionsForRunMock.mockResolvedValue([elsewhereDecision()]);
    findCanonicalReviewObservationMock.mockResolvedValue({
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
    });
    findCanonicalReviewPageMock.mockResolvedValue({
      id: "page-es",
      crawlRunId: "crawl-1",
      requestedUrl: PAGE_URL,
      finalUrl: PAGE_URL,
      canonical: CANONICAL_URL,
    });
    insertCanonicalReviewMock.mockImplementation(async (input: { outcome: string }) =>
      storedReview(input.outcome as "intentional" | "needs_change" | "unsure"),
    );
    listCanonicalReviewsForWebsiteMock.mockResolvedValue([]);
  });

  it("persists intentional, needs_change, and unsure without a mutation_spec", async () => {
    for (const outcome of ["intentional", "needs_change", "unsure"] as const) {
      const view = await submitCanonicalReview({
        websiteId: WEBSITE_ID,
        sessionToken: SESSION,
        decisionId: "decision-1",
        outcome,
      });
      expect(view.outcome).toBe(outcome);
      expect(view.reviewType).toBe("review_canonical_target");
      expect(view).not.toHaveProperty("mutationSpec");
      expect(view).not.toHaveProperty("status");
      expect(view.pageUrl).toBe(PAGE_URL);
      expect(view.canonicalUrl).toBe(CANONICAL_URL);
    }

    expect(insertCanonicalReviewMock).toHaveBeenCalledTimes(3);
    expect(insertCanonicalReviewMock.mock.calls[0][0]).not.toHaveProperty("mutationSpec");
    expect(insertCanonicalReviewMock.mock.calls[0][0]).not.toHaveProperty("field");
    expect(insertCanonicalReviewMock.mock.calls[0][0]).not.toHaveProperty("before");
    expect(insertCanonicalReviewMock.mock.calls[0][0]).not.toHaveProperty("after");
    expect(insertCanonicalReviewMock.mock.calls[0][0].pageUrl).toBe(PAGE_URL);
    expect(insertCanonicalReviewMock.mock.calls[0][0].pageUrl).not.toBe(GSC_URL);
  });

  it("rejects missing canonical and invalid outcomes", async () => {
    findDecisionByIdMock.mockResolvedValue(missingCanonicalDecision());
    await expect(
      submitCanonicalReview({
        websiteId: WEBSITE_ID,
        sessionToken: SESSION,
        decisionId: "decision-missing",
        outcome: "intentional",
      }),
    ).rejects.toMatchObject({ code: "unsupported_decision" });

    findDecisionByIdMock.mockResolvedValue(elsewhereDecision());
    await expect(
      submitCanonicalReview({
        websiteId: WEBSITE_ID,
        sessionToken: SESSION,
        decisionId: "decision-1",
        outcome: "approved",
      }),
    ).rejects.toMatchObject({ code: "invalid_review_outcome" });

    expect(insertCanonicalReviewMock).not.toHaveBeenCalled();
  });

  it("denies the wrong owner and does not insert", async () => {
    requireObserveOwnerMock.mockRejectedValue(new ObserveAuthError(403, "Not authorized."));

    await expect(
      submitCanonicalReview({
        websiteId: WEBSITE_ID,
        sessionToken: SESSION,
        decisionId: "decision-1",
        outcome: "intentional",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(insertCanonicalReviewMock).not.toHaveBeenCalled();
  });

  it("exposes the observation page and keeps the review current after a later crawl of the same relationship", async () => {
    listCanonicalReviewsForWebsiteMock.mockResolvedValue([storedReview("intentional")]);

    const listed = await listCanonicalReviewsForOwner({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
    });

    expect(listed.targets).toHaveLength(1);
    expect(listed.targets[0].identity.pageUrl).toBe(PAGE_URL);
    expect(listed.targets[0].identity.canonicalUrl).toBe(CANONICAL_URL);
    expect(listed.targets[0].identity.pageUrl).not.toBe(GSC_URL);
    expect(listed.targets[0].review?.currency).toBe("current");
    expect(listed.reviews[0].outcome).toBe("intentional");

    listDecisionsForRunMock.mockResolvedValue([
      {
        ...elsewhereDecision(),
        id: "decision-2",
      },
    ]);
    findCanonicalReviewObservationMock.mockResolvedValue({
      id: "obs-new",
      pageId: "page-es",
      pageUrl: PAGE_URL,
      crawlRunId: "crawl-2",
      ruleKey: "indexability.canonical_points_elsewhere",
      status: "active",
      evidence: {
        requestedUrl: PAGE_URL,
        finalUrl: PAGE_URL,
        canonical: CANONICAL_URL,
      },
    });
    findCanonicalReviewPageMock.mockResolvedValue({
      id: "page-es",
      crawlRunId: "crawl-2",
      requestedUrl: PAGE_URL,
      finalUrl: PAGE_URL,
      canonical: CANONICAL_URL,
    });

    const regenerated = await listCanonicalReviewsForOwner({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
    });

    expect(regenerated.reviews).toHaveLength(1);
    expect(regenerated.reviews[0].currency).toBe("current");
    expect(regenerated.reviews[0].observationId).toBe("obs-es");
    expect(regenerated.reviews[0].crawlRunId).toBe("crawl-1");
    expect(regenerated.targets[0].review?.id).toBe("review-intentional");
    expect(regenerated.targets[0].review?.currency).toBe("current");
    expect(regenerated.targets[0].identity.observationId).toBe("obs-new");
    expect(regenerated.targets[0].identity.crawlRunId).toBe("crawl-2");
    expect(insertCanonicalReviewMock).not.toHaveBeenCalled();
  });

  it("marks the frozen review stale when the canonical href changes and does not rewrite it", async () => {
    listCanonicalReviewsForWebsiteMock.mockResolvedValue([storedReview("intentional")]);
    findCanonicalReviewObservationMock.mockResolvedValue({
      id: "obs-new",
      pageId: "page-es",
      pageUrl: PAGE_URL,
      crawlRunId: "crawl-2",
      ruleKey: "indexability.canonical_points_elsewhere",
      status: "active",
      evidence: {
        requestedUrl: PAGE_URL,
        finalUrl: PAGE_URL,
        canonical: "https://www.dbhobby.com/ca/pintura-en-seda",
      },
    });
    findCanonicalReviewPageMock.mockResolvedValue({
      id: "page-es",
      crawlRunId: "crawl-2",
      requestedUrl: PAGE_URL,
      finalUrl: PAGE_URL,
      canonical: "https://www.dbhobby.com/ca/pintura-en-seda",
    });

    const listed = await listCanonicalReviewsForOwner({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
    });

    expect(listed.reviews[0].currency).toBe("stale");
    expect(listed.reviews[0].canonicalUrl).toBe(CANONICAL_URL);
    expect(listed.reviews[0].observationId).toBe("obs-es");
    expect(listed.reviews[0].crawlRunId).toBe("crawl-1");
    expect(listed.targets[0].identity.canonicalUrl).toBe("https://www.dbhobby.com/ca/pintura-en-seda");
    expect(listed.targets[0].review?.currency).toBe("stale");
    expect(insertCanonicalReviewMock).not.toHaveBeenCalled();
  });

  it("does not list a target for missing canonical", async () => {
    listDecisionsForRunMock.mockResolvedValue([missingCanonicalDecision()]);

    const listed = await listCanonicalReviewsForOwner({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
    });

    expect(listed.targets).toEqual([]);
  });

  it("marks a prior review stale when the canonical relationship can no longer be matched", async () => {
    listCanonicalReviewsForWebsiteMock.mockResolvedValue([storedReview("intentional")]);
    listDecisionsForRunMock.mockResolvedValue([missingCanonicalDecision()]);

    const listed = await listCanonicalReviewsForOwner({
      websiteId: WEBSITE_ID,
      sessionToken: SESSION,
    });

    expect(listed.targets).toEqual([]);
    expect(listed.reviews[0].currency).toBe("stale");
    expect(listed.reviews[0].observationId).toBe("obs-es");
    expect(listed.reviews[0].crawlRunId).toBe("crawl-1");
    expect(listed.reviews[0].canonicalUrl).toBe(CANONICAL_URL);
  });
});
