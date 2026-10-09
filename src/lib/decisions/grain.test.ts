import { describe, expect, it } from "vitest";
import { IMPACT_SCORES } from "@/lib/priorities/config/impact-scores";
import { BASE_CONFIDENCE_SCORES } from "@/lib/priorities/config/confidence-scores";
import { buildRankedDecisions } from "./candidates";
import {
  DECISION_ENGINE_VERSION,
  DECISION_MAX_COUNT,
  ISSUE_IMPORTANCE_BY_LEVEL,
} from "./config";
import {
  supportedActionTypeForDecision,
  supportedReviewTypeForDecision,
} from "./supported-action";
import { combineScoring, issueImportance, searchDemandScore } from "./score";
import type {
  DecisionEngineInput,
  GscPageEvidenceInput,
  ObservationInput,
} from "./types";
import { missingMetaGroupExplanation, missingMetaGroupTitle } from "./wording";

const engine: DecisionEngineInput = {
  websiteId: "website-1",
  siteModelId: "site-model-1",
  crawlRunId: "crawl-1",
  gscSearchSyncId: "sync-1",
  engineVersion: DECISION_ENGINE_VERSION,
  goal: {
    id: "goal-1",
    primaryType: "grow_signups",
    secondaryType: null,
    note: null,
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
  gscTruncated: false,
  periodStart: "2026-08-27",
  periodEnd: "2026-09-23",
};

function page(
  overrides: Partial<GscPageEvidenceInput> & Pick<GscPageEvidenceInput, "id" | "pageUrl">,
): GscPageEvidenceInput {
  return {
    pageId: null,
    clicks: 0,
    impressions: 0,
    ...overrides,
  };
}

function observation(
  overrides: Partial<ObservationInput> & Pick<ObservationInput, "id">,
): ObservationInput {
  return {
    pageId: "page-1",
    pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
    ruleKey: "page_fundamentals.missing_meta_description",
    title: "Missing meta description",
    description: "The page does not have a meta description.",
    severity: "warning",
    status: "active",
    evidence: { metaDescription: null },
    priorityLevel: "medium",
    priorityScore: 55,
    ...overrides,
  };
}

function rank(pages: GscPageEvidenceInput[], observations: ObservationInput[]) {
  return buildRankedDecisions({
    engine,
    pages,
    observations,
  });
}

const SHARED_TITLE = "Pintura sobre seda | DBHOBBY";
const OTHER_TITLE = "Productos | DBHOBBY";

describe("Decision grain: missing meta Type C", () => {
  it("keeps a single Google-visible missing-meta page as Type A", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
          pageId: "page-1",
          impressions: 153,
          clicks: 26,
        }),
      ],
      [
        observation({
          id: "obs-1",
          pageId: "page-1",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
        }),
      ],
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0].decisionType).toBe("existing_demand_page_issue");
    expect(decisions[0].title).toBe("Add a meta description on /es/cianotipo");
    expect(supportedActionTypeForDecision(decisions[0])).toBe("update_meta_description");
  });

  it("groups two Google-visible missing-meta pages into one Type C", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
          pageId: "page-1",
          impressions: 153,
          clicks: 26,
        }),
        page({
          id: "gsc-2",
          pageUrl: "https://www.dbhobby.com/es/fijacion",
          pageId: "page-2",
          impressions: 80,
          clicks: 4,
        }),
      ],
      [
        observation({
          id: "obs-1",
          pageId: "page-1",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
        }),
        observation({
          id: "obs-2",
          pageId: "page-2",
          pageUrl: "https://www.dbhobby.com/es/fijacion",
        }),
      ],
    );

    const typeC = decisions.filter((decision) => decision.decisionType === "multi_page_issue_with_visibility");
    const typeA = decisions.filter((decision) => decision.decisionType === "existing_demand_page_issue");
    expect(typeC).toHaveLength(1);
    expect(typeA).toHaveLength(0);
    expect(typeC[0].title).toBe("Add meta descriptions on 2 Google-visible pages");
    expect(typeC[0].explanation).toBe(
      "2 pages that already appear in Google Search are missing meta descriptions. Start with the page receiving the strongest current search demand.",
    );
    expect(typeC[0].title).not.toMatch(/template/i);
    expect(typeC[0].explanation).not.toMatch(/template/i);
    expect(typeC[0].pageId).toBe("page-1");
    expect(typeC[0].pageUrl).toBe("https://www.dbhobby.com/es/cianotipo");
    expect(supportedActionTypeForDecision(typeC[0])).toBe("update_meta_description");
  });

  it("groups five Google-visible missing-meta pages into one Type C instead of five Type As", () => {
    const pages = [1, 2, 3, 4, 5].map((index) =>
      page({
        id: `gsc-${index}`,
        pageUrl: `https://www.dbhobby.com/es/page-${index}`,
        pageId: `page-${index}`,
        impressions: 200 - index * 10,
        clicks: 10 - index,
      }),
    );
    const observations = [1, 2, 3, 4, 5].map((index) =>
      observation({
        id: `obs-${index}`,
        pageId: `page-${index}`,
        pageUrl: `https://www.dbhobby.com/es/page-${index}`,
      }),
    );

    const decisions = rank(pages, observations);
    const typeC = decisions.filter((decision) => decision.decisionType === "multi_page_issue_with_visibility");
    const typeA = decisions.filter((decision) => decision.decisionType === "existing_demand_page_issue");

    expect(typeC).toHaveLength(1);
    expect(typeA).toHaveLength(0);
    expect(typeC[0].title).toBe("Add meta descriptions on 5 Google-visible pages");
    expect(typeC[0].evidenceRefs.filter((ref) => ref.kind === "observation")).toHaveLength(5);
    expect(typeC[0].pageId).toBe("page-1");
  });

  it("does not let non-visible missing-meta pages inflate the Google-visible group", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
          pageId: "page-1",
          impressions: 153,
          clicks: 26,
        }),
        page({
          id: "gsc-2",
          pageUrl: "https://www.dbhobby.com/es/fijacion",
          pageId: "page-2",
          impressions: 80,
          clicks: 4,
        }),
        page({
          id: "gsc-hidden",
          pageUrl: "https://www.dbhobby.com/es/hidden",
          pageId: "page-hidden",
          impressions: 0,
          clicks: 0,
        }),
      ],
      [
        observation({
          id: "obs-1",
          pageId: "page-1",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
        }),
        observation({
          id: "obs-2",
          pageId: "page-2",
          pageUrl: "https://www.dbhobby.com/es/fijacion",
        }),
        observation({
          id: "obs-hidden",
          pageId: "page-hidden",
          pageUrl: "https://www.dbhobby.com/es/hidden",
        }),
        observation({
          id: "obs-stale",
          pageId: "page-stale",
          pageUrl: "https://www.dbhobby.com/old",
        }),
      ],
    );

    const typeC = decisions.find((decision) => decision.decisionType === "multi_page_issue_with_visibility");
    expect(typeC?.title).toBe("Add meta descriptions on 2 Google-visible pages");
    expect(typeC?.evidenceRefs.filter((ref) => ref.kind === "observation").map((ref) => ref.recordId)).toEqual([
      "obs-1",
      "obs-2",
    ]);
  });

  it("suppresses grouped member Type As for the same rule only", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es/foo",
          pageId: "page-1",
          impressions: 212,
          clicks: 29,
        }),
        page({
          id: "gsc-2",
          pageUrl: "https://www.dbhobby.com/es/bar",
          pageId: "page-2",
          impressions: 80,
          clicks: 4,
        }),
      ],
      [
        observation({
          id: "obs-meta-1",
          pageId: "page-1",
          pageUrl: "https://www.dbhobby.com/es/foo",
        }),
        observation({
          id: "obs-canonical-1",
          pageId: "page-1",
          pageUrl: "https://www.dbhobby.com/es/foo",
          ruleKey: "indexability.canonical_points_elsewhere",
          title: "Canonical points elsewhere",
          priorityLevel: "medium",
        }),
        observation({
          id: "obs-meta-2",
          pageId: "page-2",
          pageUrl: "https://www.dbhobby.com/es/bar",
        }),
      ],
    );

    const typeC = decisions.filter((decision) => decision.decisionType === "multi_page_issue_with_visibility");
    const typeA = decisions.filter((decision) => decision.decisionType === "existing_demand_page_issue");
    expect(typeC).toHaveLength(1);
    expect(typeC[0].title).toBe("Add meta descriptions on 2 Google-visible pages");
    expect(typeA).toHaveLength(1);
    expect(typeA[0].title).toBe("Review the canonical URL on /es/foo");
    expect(typeA[0].pageId).toBe("page-1");
    expect(supportedReviewTypeForDecision(typeA[0])).toBe("review_canonical_target");
  });

  it("selects the highest-demand mapped page as the deterministic primary", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-low",
          pageUrl: "https://www.dbhobby.com/a",
          pageId: "page-a",
          impressions: 40,
          clicks: 2,
        }),
        page({
          id: "gsc-high",
          pageUrl: "https://www.dbhobby.com/z",
          pageId: "page-z",
          impressions: 400,
          clicks: 20,
        }),
      ],
      [
        observation({
          id: "obs-a",
          pageId: "page-a",
          pageUrl: "https://www.dbhobby.com/a",
        }),
        observation({
          id: "obs-z",
          pageId: "page-z",
          pageUrl: "https://www.dbhobby.com/z",
        }),
      ],
    );

    expect(decisions[0].pageId).toBe("page-z");
    expect(decisions[0].pageUrl).toBe("https://www.dbhobby.com/z");
    const primaryPage = decisions[0].evidenceRefs.find(
      (ref) => ref.kind === "page" && ref.recordId === "page-z",
    );
    expect(primaryPage?.snapshot.primaryReason).toBe("decision_primary_highest_demand");
  });

  it("does not inflate Type C score just because more pages share the issue", () => {
    const twoPages = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
          pageId: "page-1",
          impressions: 153,
          clicks: 26,
        }),
        page({
          id: "gsc-2",
          pageUrl: "https://www.dbhobby.com/es/fijacion",
          pageId: "page-2",
          impressions: 80,
          clicks: 4,
        }),
      ],
      [
        observation({
          id: "obs-1",
          pageId: "page-1",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
        }),
        observation({
          id: "obs-2",
          pageId: "page-2",
          pageUrl: "https://www.dbhobby.com/es/fijacion",
        }),
      ],
    );
    const fivePages = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
          pageId: "page-1",
          impressions: 153,
          clicks: 26,
        }),
        page({
          id: "gsc-2",
          pageUrl: "https://www.dbhobby.com/es/fijacion",
          pageId: "page-2",
          impressions: 80,
          clicks: 4,
        }),
        page({
          id: "gsc-3",
          pageUrl: "https://www.dbhobby.com/es/three",
          pageId: "page-3",
          impressions: 60,
          clicks: 3,
        }),
        page({
          id: "gsc-4",
          pageUrl: "https://www.dbhobby.com/es/four",
          pageId: "page-4",
          impressions: 40,
          clicks: 2,
        }),
        page({
          id: "gsc-5",
          pageUrl: "https://www.dbhobby.com/es/five",
          pageId: "page-5",
          impressions: 20,
          clicks: 1,
        }),
      ],
      [
        observation({
          id: "obs-1",
          pageId: "page-1",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
        }),
        observation({
          id: "obs-2",
          pageId: "page-2",
          pageUrl: "https://www.dbhobby.com/es/fijacion",
        }),
        observation({
          id: "obs-3",
          pageId: "page-3",
          pageUrl: "https://www.dbhobby.com/es/three",
        }),
        observation({
          id: "obs-4",
          pageId: "page-4",
          pageUrl: "https://www.dbhobby.com/es/four",
        }),
        observation({
          id: "obs-5",
          pageId: "page-5",
          pageUrl: "https://www.dbhobby.com/es/five",
        }),
      ],
    );

    const expected = combineScoring({
      issueImportance: issueImportance(
        observation({
          id: "obs-1",
          pageId: "page-1",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
        }),
      ),
      searchDemand: 100,
      evidenceConfidence: 90,
    });

    expect(twoPages[0].scoring).toEqual(expected);
    expect(fivePages[0].scoring).toEqual(expected);
    expect(twoPages[0].scoring.total).toBe(fivePages[0].scoring.total);
  });

  it("keeps the grouped candidate at least as rank-competitive as the strongest Type A it suppresses", () => {
    const highImpressionNoClicks = page({
      id: "gsc-high-imp",
      pageUrl: "https://www.dbhobby.com/es/high-impressions",
      pageId: "page-high-imp",
      impressions: 100,
      clicks: 0,
    });
    const strongerClickBoost = page({
      id: "gsc-strong",
      pageUrl: "https://www.dbhobby.com/es/strong-demand",
      pageId: "page-strong",
      impressions: 90,
      clicks: 5,
    });
    const metaHighImp = observation({
      id: "obs-high-imp",
      pageId: "page-high-imp",
      pageUrl: "https://www.dbhobby.com/es/high-impressions",
    });
    const metaStrong = observation({
      id: "obs-strong",
      pageId: "page-strong",
      pageUrl: "https://www.dbhobby.com/es/strong-demand",
    });
    const competingPages = [1, 2, 3, 4, 5].map((index) =>
      page({
        id: `gsc-canonical-${index}`,
        pageUrl: `https://www.dbhobby.com/es/canonical-${index}`,
        pageId: `page-canonical-${index}`,
        impressions: 86,
        clicks: 1,
      }),
    );
    const competingObservations = competingPages.map((gscPage, index) =>
      observation({
        id: `obs-canonical-${index + 1}`,
        pageId: gscPage.pageId,
        pageUrl: gscPage.pageUrl,
        ruleKey: "indexability.canonical_points_elsewhere",
        title: "Canonical points elsewhere",
      }),
    );

    const maxDemand = 100;
    const confidence = 90;
    const typeAScores = [highImpressionNoClicks, strongerClickBoost].map((gscPage, index) =>
      combineScoring({
        issueImportance: issueImportance(index === 0 ? metaHighImp : metaStrong),
        searchDemand: searchDemandScore(gscPage, maxDemand),
        evidenceConfidence: confidence,
      }),
    );
    const strongestTypeA = typeAScores.reduce((best, score) => (score.total > best.total ? score : best));

    const decisions = rank(
      [highImpressionNoClicks, strongerClickBoost, ...competingPages],
      [metaHighImp, metaStrong, ...competingObservations],
    );
    const typeC = decisions.filter((decision) => decision.decisionType === "multi_page_issue_with_visibility");
    const suppressedTypeA = decisions.filter(
      (decision) =>
        decision.decisionType === "existing_demand_page_issue" &&
        decision.evidenceRefs.some(
          (ref) =>
            ref.kind === "observation" &&
            (ref.recordId === "obs-high-imp" || ref.recordId === "obs-strong"),
        ),
    );

    expect(typeAScores[0].total).toBeLessThan(strongestTypeA.total);
    expect(typeC).toHaveLength(1);
    expect(suppressedTypeA).toHaveLength(0);
    expect(typeC[0].pageId).toBe("page-strong");
    expect(typeC[0].scoring.issueImportance).toBeGreaterThanOrEqual(
      Math.max(issueImportance(metaHighImp), issueImportance(metaStrong)),
    );
    expect(typeC[0].scoring.searchDemand).toBe(searchDemandScore(strongerClickBoost, maxDemand));
    expect(typeC[0].scoring.evidenceConfidence).toBe(confidence);
    expect(typeC[0].scoring.total).toBeGreaterThanOrEqual(strongestTypeA.total);
    expect(typeC[0].rank).toBeLessThanOrEqual(5);
    expect(decisions[0]).toMatchObject({
      decisionType: "multi_page_issue_with_visibility",
      pageId: "page-strong",
    });
  });

  it("does not group missing meta by hostname or path prefix", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-es",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
          pageId: "page-es",
          impressions: 153,
          clicks: 26,
        }),
        page({
          id: "gsc-blog",
          pageUrl: "https://www.dbhobby.com/blog/notes",
          pageId: "page-blog",
          impressions: 90,
          clicks: 5,
        }),
      ],
      [
        observation({
          id: "obs-es",
          pageId: "page-es",
          pageUrl: "https://www.dbhobby.com/es/cianotipo",
        }),
        observation({
          id: "obs-blog",
          pageId: "page-blog",
          pageUrl: "https://www.dbhobby.com/blog/notes",
        }),
      ],
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0].decisionType).toBe("multi_page_issue_with_visibility");
    expect(decisions[0].title).toBe("Add meta descriptions on 2 Google-visible pages");
  });
});

describe("Decision grain: duplicate title consolidation", () => {
  it("emits one Type C for one exact shared title across four Google-visible pages", () => {
    const pages = [
      page({
        id: "gsc-home",
        pageUrl: "https://www.dbhobby.com/",
        pageId: "page-home",
        impressions: 200,
        clicks: 16,
      }),
      page({
        id: "gsc-ca",
        pageUrl: "https://www.dbhobby.com/ca",
        pageId: "page-ca",
        impressions: 80,
        clicks: 6,
      }),
      page({
        id: "gsc-es",
        pageUrl: "https://www.dbhobby.com/es",
        pageId: "page-es",
        impressions: 120,
        clicks: 8,
      }),
      page({
        id: "gsc-en",
        pageUrl: "https://www.dbhobby.com/en",
        pageId: "page-en",
        impressions: 60,
        clicks: 4,
      }),
    ];
    const observations = [
      observation({
        id: "obs-home",
        pageId: "page-home",
        pageUrl: "https://www.dbhobby.com/",
        ruleKey: "page_fundamentals.duplicate_title",
        title: "Duplicate page title",
        evidence: { title: SHARED_TITLE },
      }),
      observation({
        id: "obs-ca",
        pageId: "page-ca",
        pageUrl: "https://www.dbhobby.com/ca",
        ruleKey: "page_fundamentals.duplicate_title",
        title: "Duplicate page title",
        evidence: { title: SHARED_TITLE },
      }),
      observation({
        id: "obs-es",
        pageId: "page-es",
        pageUrl: "https://www.dbhobby.com/es",
        ruleKey: "page_fundamentals.duplicate_title",
        title: "Duplicate page title",
        evidence: { title: SHARED_TITLE },
      }),
      observation({
        id: "obs-en",
        pageId: "page-en",
        pageUrl: "https://www.dbhobby.com/en",
        ruleKey: "page_fundamentals.duplicate_title",
        title: "Duplicate page title",
        evidence: { title: SHARED_TITLE },
      }),
    ];

    const decisions = rank(pages, observations);
    const typeC = decisions.filter((decision) => decision.decisionType === "multi_page_issue_with_visibility");
    expect(typeC).toHaveLength(1);
    expect(typeC[0].title).toBe("Make duplicate titles unique on 4 Google-visible pages including /");
    expect(typeC[0].pageId).toBe("page-home");
    expect(typeC[0].evidenceRefs.filter((ref) => ref.kind === "observation")).toHaveLength(4);
    expect(supportedActionTypeForDecision(typeC[0])).toBe("update_page_title");
  });

  it("keeps two distinct shared titles as two Type C Decisions", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-home",
          pageUrl: "https://www.dbhobby.com/",
          pageId: "page-home",
          impressions: 200,
          clicks: 16,
        }),
        page({
          id: "gsc-ca",
          pageUrl: "https://www.dbhobby.com/ca",
          pageId: "page-ca",
          impressions: 80,
          clicks: 6,
        }),
        page({
          id: "gsc-products",
          pageUrl: "https://www.dbhobby.com/es/productos",
          pageId: "page-products",
          impressions: 90,
          clicks: 5,
        }),
        page({
          id: "gsc-shop",
          pageUrl: "https://www.dbhobby.com/ca/productos",
          pageId: "page-shop",
          impressions: 70,
          clicks: 3,
        }),
      ],
      [
        observation({
          id: "obs-home",
          pageId: "page-home",
          pageUrl: "https://www.dbhobby.com/",
          ruleKey: "page_fundamentals.duplicate_title",
          title: "Duplicate page title",
          evidence: { title: SHARED_TITLE },
        }),
        observation({
          id: "obs-ca",
          pageId: "page-ca",
          pageUrl: "https://www.dbhobby.com/ca",
          ruleKey: "page_fundamentals.duplicate_title",
          title: "Duplicate page title",
          evidence: { title: SHARED_TITLE },
        }),
        observation({
          id: "obs-products",
          pageId: "page-products",
          pageUrl: "https://www.dbhobby.com/es/productos",
          ruleKey: "page_fundamentals.duplicate_title",
          title: "Duplicate page title",
          evidence: { title: OTHER_TITLE },
        }),
        observation({
          id: "obs-shop",
          pageId: "page-shop",
          pageUrl: "https://www.dbhobby.com/ca/productos",
          ruleKey: "page_fundamentals.duplicate_title",
          title: "Duplicate page title",
          evidence: { title: OTHER_TITLE },
        }),
      ],
    );

    const typeC = decisions.filter((decision) => decision.decisionType === "multi_page_issue_with_visibility");
    expect(typeC).toHaveLength(2);
    expect(typeC.map((decision) => decision.title).sort()).toEqual([
      "Make duplicate titles unique on 2 Google-visible pages including /",
      "Make duplicate titles unique on 2 Google-visible pages including /es/productos",
    ]);
  });
});

describe("Decision grain regressions", () => {
  it("keeps scoring weights, H1/canonical diagnostics, Type B, and canonical Review unchanged", () => {
    expect(DECISION_MAX_COUNT).toBe(5);
    expect(ISSUE_IMPORTANCE_BY_LEVEL.medium).toBe(55);
    expect(combineScoring({ issueImportance: 100, searchDemand: 100, evidenceConfidence: 100 }).total).toBe(100);
    expect(IMPACT_SCORES["page_fundamentals.missing_h1"]).toBe(55);
    expect(IMPACT_SCORES["indexability.canonical_missing"]).toBe(65);
    expect(IMPACT_SCORES["indexability.canonical_points_elsewhere"]).toBe(70);
    expect(BASE_CONFIDENCE_SCORES["page_fundamentals.missing_h1"]).toBe(100);

    const h1 = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es/gutta-para-seda",
          pageId: "page-1",
          impressions: 96,
          clicks: 3,
        }),
      ],
      [
        observation({
          id: "obs-h1",
          pageId: "page-1",
          pageUrl: "https://www.dbhobby.com/es/gutta-para-seda",
          ruleKey: "page_fundamentals.missing_h1",
          title: "No main heading",
        }),
      ],
    );
    expect(h1[0].decisionType).toBe("existing_demand_page_issue");
    expect(h1[0].title).toBe("Review the main heading on /es/gutta-para-seda");
    expect(supportedActionTypeForDecision(h1[0])).toBeNull();

    const canonical = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es",
          pageId: "page-es",
          impressions: 212,
          clicks: 29,
        }),
      ],
      [
        observation({
          id: "obs-canonical",
          pageId: "page-es",
          pageUrl: "https://www.dbhobby.com/es",
          ruleKey: "indexability.canonical_points_elsewhere",
          title: "Canonical points elsewhere",
        }),
      ],
    );
    expect(canonical[0].title).toBe("Review the canonical URL on /es");
    expect(supportedReviewTypeForDecision(canonical[0])).toBe("review_canonical_target");
    expect(supportedActionTypeForDecision(canonical[0])).toBeNull();

    const typeB = rank(
      [
        page({
          id: "gsc-unmapped",
          pageUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
          pageId: null,
          impressions: 153,
          clicks: 26,
        }),
      ],
      [],
    );
    expect(typeB[0].decisionType).toBe("inspect_unanalyzed_page");
    expect(supportedActionTypeForDecision(typeB[0])).toBeNull();
  });

  it("uses truthful missing-meta group wording", () => {
    expect(missingMetaGroupTitle(5)).toBe("Add meta descriptions on 5 Google-visible pages");
    expect(missingMetaGroupExplanation(5)).toBe(
      "5 pages that already appear in Google Search are missing meta descriptions. Start with the page receiving the strongest current search demand.",
    );
    expect(missingMetaGroupTitle(5)).not.toMatch(/template/i);
    expect(missingMetaGroupExplanation(5)).not.toMatch(/template/i);
  });
});
