import { describe, expect, it } from "vitest";
import { buildRankedDecisions, emptyGscProducesNoDecisions } from "./candidates";
import { staleReasonForRun, toDecisionView } from "./load";
import { bandForRank, combineScoring, hasAnySearchDemand, issueImportance } from "./score";
import type {
  DecisionEngineInput,
  DecisionRecord,
  GscPageEvidenceInput,
  GoalSnapshot,
  ObservationInput,
} from "./types";
import { actionTitleForRule, goalContextCopy } from "./wording";

const engine: DecisionEngineInput = {
  websiteId: "website-1",
  siteModelId: "site-model-1",
  crawlRunId: "crawl-1",
  gscSearchSyncId: "sync-1",
  engineVersion: "decision_v1",
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

function page(overrides: Partial<GscPageEvidenceInput> & Pick<GscPageEvidenceInput, "id" | "pageUrl">): GscPageEvidenceInput {
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
    ruleKey: "page_fundamentals.missing_title",
    title: "Missing page title",
    description: "The page does not have a title element.",
    severity: "error",
    status: "active",
    evidence: {},
    priorityLevel: "high",
    priorityScore: 80,
    ...overrides,
  };
}

function rank(pages: GscPageEvidenceInput[], observations: ObservationInput[], extra?: Partial<DecisionEngineInput>) {
  return buildRankedDecisions({
    engine: { ...engine, ...extra },
    pages,
    observations,
  });
}

describe("Decision Engine v1 candidates", () => {
  it("creates an existing-demand page issue when GSC evidence maps to an actionable observation", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
          pageId: "page-1",
          impressions: 153,
          clicks: 26,
        }),
      ],
      [observation({ id: "obs-1" })],
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      decisionType: "existing_demand_page_issue",
      title: "Improve the page title on /es/pintura-en-seda",
      pageId: "page-1",
      rank: 1,
      priorityBand: "do_first",
      confidence: "exact_match",
    });
    expect(decisions[0].explanation).toContain("already appears in Google Search");
    expect(decisions[0].explanation).toContain("missing page title");
    expect(decisions[0].evidenceRefs.some((ref) => ref.kind === "observation" && ref.recordId === "obs-1")).toBe(
      true,
    );
    expect(decisions[0].evidenceRefs.some((ref) => ref.kind === "gsc_evidence" && ref.recordId === "gsc-1")).toBe(
      true,
    );
    expect(decisions[0].evidenceRefs.some((ref) => ref.kind === "page" && ref.recordId === "page-1")).toBe(true);
    expect(decisions[0].evidenceRefs.some((ref) => ref.kind === "crawl_run" && ref.recordId === "crawl-1")).toBe(
      true,
    );
    expect(decisions[0].evidenceRefs.some((ref) => ref.kind === "gsc_sync" && ref.recordId === "sync-1")).toBe(
      true,
    );
    expect(decisions[0].evidenceRefs.some((ref) => ref.kind === "site_model" && ref.recordId === "site-model-1")).toBe(
      true,
    );
    expect(decisions[0].evidenceRefs.some((ref) => ref.kind === "goal" && ref.recordId === "goal-1")).toBe(true);
    expect(decisions[0].scoring.issueImportance).toBeGreaterThan(0);
    expect(decisions[0].scoring.searchDemand).toBeGreaterThan(0);
    expect(decisions[0].explanation).not.toMatch(/increase traffic|CTR is too low|should rank higher/i);
  });

  it("does not create a fix for GSC evidence without an actionable crawl issue", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
          pageId: "page-1",
          impressions: 400,
          clicks: 40,
        }),
      ],
      [],
    );

    expect(decisions).toEqual([]);
  });

  it("does not promote a crawl issue without GSC evidence into a cross-signal decision", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-other",
          pageUrl: "https://www.dbhobby.com/other",
          pageId: "page-9",
          impressions: 200,
          clicks: 10,
        }),
      ],
      [observation({ id: "obs-1" })],
    );

    expect(decisions).toEqual([]);
  });

  it("can inspect an unmatched Google-visible page that is outside the crawl sample", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-unmapped",
          pageUrl: "https://www.dbhobby.com/shop/new-course",
          pageId: null,
          impressions: 500,
          clicks: 40,
        }),
        page({
          id: "gsc-mapped",
          pageUrl: "https://www.dbhobby.com/",
          pageId: "page-home",
          impressions: 800,
          clicks: 20,
        }),
      ],
      [],
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      decisionType: "inspect_unanalyzed_page",
      pageId: null,
      confidence: "unmapped_page",
    });
    expect(decisions[0].title).toContain("Analyze this Google-visible page next");
    expect(decisions[0].explanation).not.toMatch(/SEO problem|title issue/i);
    expect(decisions[0].evidenceRefs.some((ref) => ref.kind === "observation")).toBe(false);
    expect(decisions[0].evidenceRefs.some((ref) => ref.kind === "gsc_evidence")).toBe(true);
  });

  it("does not inspect unmatched pages with only a tiny share of imported demand", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-top",
          pageUrl: "https://www.dbhobby.com/",
          pageId: "page-home",
          impressions: 1000,
          clicks: 50,
        }),
        page({
          id: "gsc-tiny",
          pageUrl: "https://www.dbhobby.com/obscure",
          pageId: null,
          impressions: 20,
          clicks: 0,
        }),
      ],
      [],
    );

    expect(decisions).toEqual([]);
  });

  it("promotes a single Google-visible duplicate-title page as a page issue", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-a",
          pageUrl: "https://www.dbhobby.com/a",
          pageId: "page-a",
          impressions: 200,
          clicks: 10,
        }),
      ],
      [
        observation({
          id: "obs-a",
          pageId: "page-a",
          pageUrl: "https://www.dbhobby.com/a",
          ruleKey: "page_fundamentals.duplicate_title",
          title: "Duplicate page title",
          severity: "warning",
          priorityLevel: "medium",
          evidence: { title: "Shared title" },
        }),
        observation({
          id: "obs-b",
          pageId: "page-b",
          pageUrl: "https://www.dbhobby.com/b",
          ruleKey: "page_fundamentals.duplicate_title",
          title: "Duplicate page title",
          severity: "warning",
          priorityLevel: "medium",
          evidence: { title: "Shared title" },
        }),
      ],
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0].decisionType).toBe("existing_demand_page_issue");
    expect(decisions[0].title).toContain("/a");
  });

  it("combines duplicate-title observations that affect multiple Google-visible pages", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-a",
          pageUrl: "https://www.dbhobby.com/a",
          pageId: "page-a",
          impressions: 200,
          clicks: 10,
        }),
        page({
          id: "gsc-b",
          pageUrl: "https://www.dbhobby.com/b",
          pageId: "page-b",
          impressions: 180,
          clicks: 8,
        }),
      ],
      [
        observation({
          id: "obs-a",
          pageId: "page-a",
          pageUrl: "https://www.dbhobby.com/a",
          ruleKey: "page_fundamentals.duplicate_title",
          title: "Duplicate page title",
          severity: "warning",
          priorityLevel: "medium",
          evidence: { title: "Shared title" },
        }),
        observation({
          id: "obs-b",
          pageId: "page-b",
          pageUrl: "https://www.dbhobby.com/b",
          ruleKey: "page_fundamentals.duplicate_title",
          title: "Duplicate page title",
          severity: "warning",
          priorityLevel: "medium",
          evidence: { title: "Shared title" },
        }),
      ],
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0].decisionType).toBe("multi_page_issue_with_visibility");
    expect(decisions[0].title).toContain("2 Google-visible pages");
    expect(decisions[0].evidenceRefs.filter((ref) => ref.kind === "observation")).toHaveLength(2);
    expect(decisions[0].evidenceRefs.filter((ref) => ref.kind === "gsc_evidence")).toHaveLength(2);
  });

  it("keeps one decision per page when several issues exist on the same URL", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
          pageId: "page-1",
          impressions: 153,
          clicks: 26,
        }),
      ],
      [
        observation({ id: "obs-title", ruleKey: "page_fundamentals.missing_title", priorityLevel: "high" }),
        observation({
          id: "obs-h1",
          ruleKey: "page_fundamentals.missing_h1",
          title: "Missing H1",
          severity: "warning",
          priorityLevel: "medium",
        }),
      ],
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0].evidenceRefs.find((ref) => ref.kind === "observation")?.recordId).toBe("obs-title");
  });

  it("returns at most five decisions and keeps deterministic order across repeats", () => {
    const pages = Array.from({ length: 8 }, (_, index) =>
      page({
        id: `gsc-${index}`,
        pageUrl: `https://www.dbhobby.com/p${index}`,
        pageId: `page-${index}`,
        impressions: 800 - index * 40,
        clicks: 40 - index,
      }),
    );
    const observations = pages.map((item, index) =>
      observation({
        id: `obs-${index}`,
        pageId: item.pageId,
        pageUrl: item.pageUrl,
        priorityLevel: index < 2 ? "critical" : "medium",
      }),
    );

    const first = rank(pages, observations);
    const second = rank(pages, observations);

    expect(first).toHaveLength(5);
    expect(first.map((decision) => decision.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(first[0].priorityBand).toBe("do_first");
    expect(first[1].priorityBand).toBe("next");
    expect(first[4].priorityBand).toBe("later");
    expect(second).toEqual(first);
  });

  it("does not treat info-only observations or site-discovery rules as actions", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
          pageId: "page-1",
          impressions: 400,
          clicks: 20,
        }),
      ],
      [
        observation({
          id: "obs-len",
          ruleKey: "page_fundamentals.title_length_out_of_range",
          title: "Title length outside recommended range",
          severity: "info",
          priorityLevel: null,
        }),
        observation({
          id: "obs-robots",
          pageId: "page-1",
          ruleKey: "site_discovery.robots_txt_missing",
          title: "robots.txt missing",
          severity: "warning",
          priorityLevel: "medium",
        }),
      ],
    );

    expect(decisions).toEqual([]);
  });

  it("acknowledges a bounded GSC dataset in confidence without claiming completeness", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
          pageId: "page-1",
          impressions: 153,
          clicks: 26,
        }),
      ],
      [observation({ id: "obs-1" })],
      { gscTruncated: true },
    );

    expect(decisions[0].confidence).toBe("bounded_dataset");
    expect(decisions[0].explanation).not.toMatch(/top pages across all Google data/i);
  });

  it("produces no decisions from empty GSC page evidence", () => {
    expect(emptyGscProducesNoDecisions([])).toBe(true);
    expect(rank([], [observation({ id: "obs-1" })])).toEqual([]);
  });

  it("does not create CTR, position, or query-targeting decisions", () => {
    const decisions = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
          pageId: "page-1",
          impressions: 153,
          clicks: 26,
        }),
      ],
      [observation({ id: "obs-1" })],
    );

    const serialized = JSON.stringify(decisions);
    expect(serialized).not.toMatch(/CTR is too low|position is bad|target this keyword|write content about|high potential|optimize for AI search/i);
    expect(decisions[0].decisionType).not.toBe("inspect_unanalyzed_page");
  });
});

describe("Decision Engine v1 scoring", () => {
  it("uses stored priority level for issue importance instead of reinterpreting the observation", () => {
    expect(
      issueImportance(
        observation({
          id: "obs-1",
          severity: "warning",
          priorityLevel: "critical",
        }),
      ),
    ).toBe(100);
  });

  it("stores explainable component scores rather than a public SEO score", () => {
    const scoring = combineScoring({
      issueImportance: 80,
      searchDemand: 100,
      evidenceConfidence: 90,
    });
    expect(scoring).toEqual({
      issueImportance: 80,
      searchDemand: 100,
      evidenceConfidence: 90,
      total: expect.any(Number),
    });
    expect(bandForRank(1)).toBe("do_first");
    expect(hasAnySearchDemand({ impressions: 1, clicks: 0 })).toBe(true);
  });
});

describe("Decision Engine v1 wording and explainability", () => {
  it("frames the Goal without claiming conversion impact", () => {
    const copy = goalContextCopy(engine.goal);
    expect(copy).toContain("grow sign-ups");
    expect(copy).toContain("pages that already receive Google visibility");
    expect(copy).not.toMatch(/this page will generate more sign-ups/i);
    expect(actionTitleForRule("page_fundamentals.missing_title", "https://www.dbhobby.com/es/pintura-en-seda")).toBe(
      "Improve the page title on /es/pintura-en-seda",
    );
  });

  it("builds a Why-this view from evidence refs without raw JSON", () => {
    const ranked = rank(
      [
        page({
          id: "gsc-1",
          pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
          pageId: "page-1",
          impressions: 153,
          clicks: 26,
        }),
      ],
      [observation({ id: "obs-1" })],
    )[0];

    const view = toDecisionView(
      {
        ...ranked,
        id: "decision-1",
        decisionRunId: "run-1",
        websiteId: "website-1",
        createdAt: "2026-09-24T00:00:00.000Z",
      } satisfies DecisionRecord,
      engine.goal,
      false,
    );

    expect(view.why.searchDemand).toEqual({ appearances: 153, visits: 26 });
    expect(view.why.websiteEvidence).toContain("missing page title");
    expect(view.why.goalContext).toContain("grow sign-ups");
    expect(view.why.matchingConfidence).toContain("matched this Google Search URL");
  });
});

describe("Decision Engine v1 staleness", () => {
  const goal: GoalSnapshot = engine.goal;
  const run = {
    siteModelId: "site-model-1",
    crawlRunId: "crawl-1",
    gscSearchSyncId: "sync-1",
    goalSnapshot: goal,
  };

  it("is stale when the crawl, GSC sync, Goal, or Site Model changes", () => {
    expect(
      staleReasonForRun({
        run,
        siteModelId: "site-model-1",
        crawlRunId: "crawl-1",
        gscSearchSyncId: "sync-1",
        goal,
      }),
    ).toBeNull();
    expect(
      staleReasonForRun({
        run,
        siteModelId: "site-model-1",
        crawlRunId: "crawl-2",
        gscSearchSyncId: "sync-1",
        goal,
      }),
    ).toBe("crawl");
    expect(
      staleReasonForRun({
        run,
        siteModelId: "site-model-1",
        crawlRunId: "crawl-1",
        gscSearchSyncId: "sync-2",
        goal,
      }),
    ).toBe("gsc_sync");
    expect(
      staleReasonForRun({
        run,
        siteModelId: "site-model-2",
        crawlRunId: "crawl-1",
        gscSearchSyncId: "sync-1",
        goal,
      }),
    ).toBe("site_model");
    expect(
      staleReasonForRun({
        run,
        siteModelId: "site-model-1",
        crawlRunId: "crawl-1",
        gscSearchSyncId: "sync-1",
        goal: { ...goal, updatedAt: "2026-09-24T00:00:00.000Z" },
      }),
    ).toBe("goal");
  });
});
