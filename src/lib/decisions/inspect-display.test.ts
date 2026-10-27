import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  INSPECT_AMBIGUOUS_CANNOT_COPY,
  INSPECT_CLEAR_CANNOT_COPY,
  INSPECT_CLEAR_EVIDENCE_COPY,
  INSPECT_CTA_LABEL,
  INSPECT_FORBIDDEN_COPY,
  INSPECT_GSC_UNAVAILABLE_COPY,
  INSPECT_NO_MATCH_CANNOT_COPY,
  INSPECT_REVIEW_AFTER_OBSERVE_COPY,
  INSPECT_REVIEW_AMBIGUOUS_COPY,
  INSPECT_REVIEW_PAGE_COPY,
  INSPECT_REVIEW_SAMPLE_COPY,
  INSPECT_STATE_COPY,
  INSPECT_STALE_NEXT_STEP_COPY,
  INSPECT_T1_NO_MATCH_CANNOT_COPY,
  inspectBoundedCrawlCopy,
  inspectDecisionTitle,
  inspectExplanation,
  inspectGscCopy,
  inspectionViewFromDecision,
  withInspectionCurrency,
} from "./inspect-display";
import { RESEARCH_INSPECT_DECISION_TYPE, type ResearchInspectDecisionRecord } from "./types";

describe("related demand inspection copy", () => {
  it("uses investigation wording and omits forbidden claims", () => {
    const title = inspectDecisionTitle("como pintar en seda");
    const explanation = inspectExplanation({
      state: "no_obvious_match_in_current_crawl",
      crawlBounded: true,
      pagesCrawled: 10,
      pagesDiscovered: 347,
      gscCopy: inspectGscCopy("not_in_current_gsc_sample", true),
    });
    const blob = [
      title,
      explanation,
      INSPECT_STATE_COPY.clear_existing_page_evidence,
      INSPECT_STATE_COPY.no_obvious_match_after_targeted_observation,
      INSPECT_STATE_COPY.ambiguous,
      INSPECT_GSC_UNAVAILABLE_COPY,
      INSPECT_REVIEW_PAGE_COPY,
      INSPECT_REVIEW_SAMPLE_COPY,
      INSPECT_REVIEW_AFTER_OBSERVE_COPY,
      INSPECT_REVIEW_AMBIGUOUS_COPY,
      INSPECT_CLEAR_CANNOT_COPY,
      INSPECT_NO_MATCH_CANNOT_COPY,
      INSPECT_T1_NO_MATCH_CANNOT_COPY,
      INSPECT_AMBIGUOUS_CANNOT_COPY,
      INSPECT_CLEAR_EVIDENCE_COPY,
      INSPECT_STALE_NEXT_STEP_COPY,
    ].join("\n");

    expect(INSPECT_CTA_LABEL).toBe("Check existing pages");
    expect(title).toContain("como pintar en seda");
    expect(explanation).toContain("10 pages fetched from 347 discovered URLs");
    expect(explanation).not.toContain("bounded sample");
    expect(
      inspectBoundedCrawlCopy({ bounded: true, pagesCrawled: 10, pagesDiscovered: 347 }),
    ).toBe("This inspection used the current crawl sample: 10 pages fetched from 347 discovered URLs.");
    expect(inspectGscCopy("gsc_unavailable", false)).toBe(INSPECT_GSC_UNAVAILABLE_COPY);
    expect(inspectGscCopy("gsc_unavailable", false)).not.toMatch(/not in Google|does not rank|no search visibility/i);
    for (const phrase of INSPECT_FORBIDDEN_COPY) {
      expect(blob.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it("renders each inspection_state without ranking, score, or v1 confidence copy", () => {
    const base: Omit<ResearchInspectDecisionRecord, "inspectionState"> = {
      id: "decision-inspect-1",
      decisionRunId: "inspect-run-1",
      websiteId: "website-1",
      createdAt: "2026-10-16T00:00:00.000Z",
      decisionType: RESEARCH_INSPECT_DECISION_TYPE,
      title: "Check whether current pages cover “como pintar en seda”",
      explanation: "inspection",
      pageUrl: null,
      pageId: null,
      priorityBand: null,
      rank: null,
      scoring: null,
      confidence: null,
      evidenceRefs: [
        {
          kind: "research_idea",
          recordId: "idea-1",
          snapshot: { gscCopy: INSPECT_GSC_UNAVAILABLE_COPY },
        },
        {
          kind: "crawl_run",
          recordId: "crawl-1",
          snapshot: { bounded: true, pagesCrawled: 10, pagesDiscovered: 347 },
        },
      ],
    };

    const clear = inspectionViewFromDecision({
      ...base,
      inspectionState: "clear_existing_page_evidence",
    });
    const noMatch = inspectionViewFromDecision({
      ...base,
      inspectionState: "no_obvious_match_in_current_crawl",
    });
    const afterObserve = inspectionViewFromDecision({
      ...base,
      inspectionState: "no_obvious_match_after_targeted_observation",
    });
    const ambiguous = inspectionViewFromDecision({
      ...base,
      inspectionState: "ambiguous",
    });

    expect(clear.state).toBe("clear_existing_page_evidence");
    expect(clear.resultCopy).toBe(INSPECT_STATE_COPY.clear_existing_page_evidence);
    expect(noMatch.state).toBe("no_obvious_match_in_current_crawl");
    expect(noMatch.resultCopy).toBe(INSPECT_STATE_COPY.no_obvious_match_in_current_crawl);
    expect(afterObserve.state).toBe("no_obvious_match_after_targeted_observation");
    expect(afterObserve.resultCopy).toBe(
      INSPECT_STATE_COPY.no_obvious_match_after_targeted_observation,
    );
    expect(ambiguous.state).toBe("ambiguous");
    expect(ambiguous.resultCopy).toBe(INSPECT_STATE_COPY.ambiguous);

    for (const view of [clear, noMatch, afterObserve, ambiguous]) {
      expect(view).not.toHaveProperty("rank");
      expect(view).not.toHaveProperty("priorityBand");
      expect(view).not.toHaveProperty("confidence");
      expect(view).not.toHaveProperty("scoring");
      expect(view).not.toHaveProperty("supportedActionType");
      expect(JSON.stringify(view)).not.toMatch(/Do first|Next|Later|exact_match|bounded_dataset|unmapped_page|issueImportance|searchDemand/);
      expect(view.crawlBoundedCopy).toBe(
        "This inspection used the current crawl sample: 10 pages fetched from 347 discovered URLs.",
      );
    }
  });

  it("keeps UI and inspect modules free of create/rank claims", () => {
    const files = [
      readFileSync(path.join(__dirname, "inspect.ts"), "utf8"),
      readFileSync(path.join(__dirname, "inspect-match.ts"), "utf8"),
      readFileSync(path.join(__dirname, "../../app/api/websites/[websiteId]/research/ideas/[ideaId]/inspect/route.ts"), "utf8"),
      readFileSync(path.join(__dirname, "../../components/site/SiteResearchSection.tsx"), "utf8"),
    ].join("\n");
    for (const phrase of INSPECT_FORBIDDEN_COPY) {
      expect(files.toLowerCase()).not.toContain(phrase.toLowerCase());
    }
    expect(files).not.toMatch(/rank:\s*1/);
    expect(files).not.toMatch(/priorityBand:\s*"next"/);
    expect(files).not.toMatch(/inspectScoring/);
    expect(files).toContain("SiteObserveIdeaPanel");
    expect(files).toContain("INSPECT_CTA_LABEL");
    expect(files).not.toContain("SiteDecisionsSection");
    expect(files).not.toContain("DECISION_GENERATE_LABEL");
    expect(files).not.toContain("prepareAction");
  });
});

function inspectRecord(
  overrides: Partial<ResearchInspectDecisionRecord> = {},
): ResearchInspectDecisionRecord {
  return {
    id: "decision-inspect-1",
    decisionRunId: "inspect-run-1",
    websiteId: "website-1",
    createdAt: "2026-10-16T00:00:00.000Z",
    decisionType: RESEARCH_INSPECT_DECISION_TYPE,
    title: "Check whether current pages cover “como pintar en seda”",
    explanation: "inspection",
    pageUrl: null,
    pageId: null,
    priorityBand: null,
    rank: null,
    scoring: null,
    confidence: null,
    inspectionState: "no_obvious_match_in_current_crawl",
    evidenceRefs: [
      {
        kind: "research_idea",
        recordId: "idea-1",
        snapshot: {
          keyword: "como pintar en seda",
          gscCopy: INSPECT_GSC_UNAVAILABLE_COPY,
          gscStatus: "gsc_unavailable",
        },
      },
      {
        kind: "crawl_run",
        recordId: "crawl-1",
        snapshot: { bounded: true, pagesCrawled: 10, pagesDiscovered: 347 },
      },
    ],
    ...overrides,
  };
}

function interpretationBlob(view: ReturnType<typeof inspectionViewFromDecision>): string {
  return [
    view.opportunityCopy,
    view.pageRelationshipCopy,
    view.resultCopy,
    view.evidenceCopy,
    view.limitationCopy,
    view.cannotConcludeCopy,
    view.gscCopy,
    view.nextStepCopy,
    view.pageUrl,
    view.pageTitle,
  ]
    .filter(Boolean)
    .join("\n");
}

describe("Release C v0 read-time inspection interpretation", () => {
  it("A: treats a clear page relationship as review, not optimization", () => {
    const view = inspectionViewFromDecision(
      inspectRecord({
        inspectionState: "clear_existing_page_evidence",
        pageId: "page-1",
        pageUrl: "https://www.dbhobby.com/es/seda",
        evidenceRefs: [
          {
            kind: "research_idea",
            recordId: "idea-1",
            snapshot: {
              keyword: "como pintar en seda",
              gscCopy: INSPECT_GSC_UNAVAILABLE_COPY,
              gscStatus: "gsc_unavailable",
            },
          },
          {
            kind: "crawl_run",
            recordId: "crawl-1",
            snapshot: { bounded: true, pagesCrawled: 10, pagesDiscovered: 347 },
          },
          {
            kind: "page",
            recordId: "page-1",
            snapshot: { pageUrl: "https://www.dbhobby.com/es/seda", title: "Pintura en seda" },
          },
        ],
      }),
    );

    expect(view.state).toBe("clear_existing_page_evidence");
    expect(view.pageRelationship).toBe("clear_existing_page");
    expect(view.pageUrl).toBe("https://www.dbhobby.com/es/seda");
    expect(view.pageTitle).toBe("Pintura en seda");
    expect(view.nextStepCopy).toBe(INSPECT_REVIEW_PAGE_COPY);
    expect(view.evidenceCopy).toBe(INSPECT_CLEAR_EVIDENCE_COPY);
    expect(view.cannotConcludeCopy).toBe(INSPECT_CLEAR_CANNOT_COPY);
    expect(view.gscAvailable).toBe(false);
    expect(interpretationBlob(view).toLowerCase()).not.toMatch(
      /must be optimized|rewrite|best landing page should/,
    );
    for (const phrase of INSPECT_FORBIDDEN_COPY) {
      expect(interpretationBlob(view).toLowerCase()).not.toContain(phrase.toLowerCase());
    }
  });

  it("keeps a clear page relationship when GSC is unavailable", () => {
    const view = inspectionViewFromDecision(
      inspectRecord({
        inspectionState: "clear_existing_page_evidence",
        pageId: "page-1",
        pageUrl: "https://www.example.com/guide",
        evidenceRefs: [
          {
            kind: "research_idea",
            recordId: "idea-1",
            snapshot: {
              keyword: "como pintar en seda",
              gscCopy: INSPECT_GSC_UNAVAILABLE_COPY,
              gscStatus: "gsc_unavailable",
            },
          },
          {
            kind: "crawl_run",
            recordId: "crawl-1",
            snapshot: { bounded: false },
          },
          {
            kind: "page",
            recordId: "page-1",
            snapshot: { pageUrl: "https://www.example.com/guide", title: "Guide" },
          },
        ],
      }),
    );

    expect(view.pageRelationship).toBe("clear_existing_page");
    expect(view.gscAvailable).toBe(false);
    expect(view.gscCopy).toBe(INSPECT_GSC_UNAVAILABLE_COPY);
    expect(view.gscCopy).not.toMatch(/0 impressions|0 clicks|no Google demand|not_in_current_gsc_sample/i);
  });

  it("does not let GSC sample presence create a page relationship", () => {
    const view = inspectionViewFromDecision(
      inspectRecord({
        inspectionState: "no_obvious_match_in_current_crawl",
        evidenceRefs: [
          {
            kind: "research_idea",
            recordId: "idea-1",
            snapshot: {
              keyword: "como pintar en seda",
              gscCopy: inspectGscCopy("in_current_gsc_sample", false),
              gscStatus: "in_current_gsc_sample",
            },
          },
          {
            kind: "gsc_sync",
            recordId: "gsc-1",
            snapshot: { gscStatus: "in_current_gsc_sample" },
          },
          {
            kind: "crawl_run",
            recordId: "crawl-1",
            snapshot: { bounded: true, pagesCrawled: 10, pagesDiscovered: 347 },
          },
        ],
      }),
    );

    expect(view.pageRelationship).toBe("none_in_crawl_sample");
    expect(view.pageUrl).toBeNull();
    expect(view.gscAvailable).toBe(true);
    expect(view.nextStepCopy).toBe(INSPECT_REVIEW_SAMPLE_COPY);
  });

  it("B: keeps T0 no-match bounded to the crawl sample", () => {
    const view = inspectionViewFromDecision(inspectRecord());
    expect(view.pageRelationship).toBe("none_in_crawl_sample");
    expect(view.crawlBounded).toBe(true);
    expect(view.limitationCopy).toMatch(/10 pages fetched from 347 discovered URLs/);
    expect(view.cannotConcludeCopy).toBe(INSPECT_NO_MATCH_CANNOT_COPY);
    expect(view.nextStepCopy).toBe(INSPECT_REVIEW_SAMPLE_COPY);
    expect(interpretationBlob(view).toLowerCase()).not.toContain("content gap");
    expect(interpretationBlob(view).toLowerCase()).not.toContain("missing page");
  });

  it("C: does not fabricate a next page when T0 has no match", () => {
    const view = inspectionViewFromDecision(inspectRecord());
    expect(view.pageUrl).toBeNull();
    expect(view.nextStepCopy).not.toMatch(/https?:\/\//);
    expect(view.nextStepCopy).not.toMatch(/observe this page/i);
    expect(JSON.stringify(view)).not.toContain("pintura-en-seda");
  });

  it("D: preserves exact T0 GSC and targeted observation provenance on a positive T1", () => {
    const view = inspectionViewFromDecision(
      inspectRecord({
        inspectionState: "clear_existing_page_evidence",
        pageId: "page-t1",
        pageUrl: "https://www.dbhobby.com/es/pintar-en-seda",
        evidenceRefs: [
          {
            kind: "research_idea",
            recordId: "idea-1",
            snapshot: {
              keyword: "como pintar en seda",
              gscCopy: "This related search is not present in the current Google Search sample.",
              gscStatus: "not_in_current_gsc_sample",
            },
          },
          {
            kind: "gsc_sync",
            recordId: "gsc-original",
            snapshot: { truncated: false, gscStatus: "not_in_current_gsc_sample" },
          },
          {
            kind: "crawl_run",
            recordId: "crawl-1",
            snapshot: { bounded: true, pagesCrawled: 10, pagesDiscovered: 347 },
          },
          {
            kind: "targeted_observation",
            recordId: "obs-1",
            snapshot: { requested_url: "https://www.dbhobby.com/es/pintar-en-seda" },
          },
          {
            kind: "page",
            recordId: "page-t1",
            snapshot: {
              pageUrl: "https://www.dbhobby.com/es/pintar-en-seda",
              title: "Pintar en seda",
            },
          },
        ],
      }),
    );

    expect(view.pageRelationship).toBe("clear_existing_page");
    expect(view.targetedObservationId).toBe("obs-1");
    expect(view.crawlRunId).toBe("crawl-1");
    expect(view.gscCopy).toBe("This related search is not present in the current Google Search sample.");
    expect(JSON.stringify(view.gscCopy)).not.toContain("gsc-newer");
    expect(view.nextStepCopy).toBe(INSPECT_REVIEW_PAGE_COPY);
  });

  it("E: does not treat T1 no-match as a content gap", () => {
    const view = inspectionViewFromDecision(
      inspectRecord({
        inspectionState: "no_obvious_match_after_targeted_observation",
        evidenceRefs: [
          {
            kind: "research_idea",
            recordId: "idea-1",
            snapshot: {
              keyword: "como pintar en seda",
              gscCopy: INSPECT_GSC_UNAVAILABLE_COPY,
              gscStatus: "gsc_unavailable",
            },
          },
          {
            kind: "crawl_run",
            recordId: "crawl-1",
            snapshot: { bounded: true, pagesCrawled: 10, pagesDiscovered: 347 },
          },
          {
            kind: "targeted_observation",
            recordId: "obs-1",
            snapshot: {},
          },
        ],
      }),
    );

    expect(view.pageRelationship).toBe("none_after_targeted_observation");
    expect(view.pageUrl).toBeNull();
    expect(view.nextStepCopy).toBe(INSPECT_REVIEW_AFTER_OBSERVE_COPY);
    expect(view.cannotConcludeCopy).toBe(INSPECT_T1_NO_MATCH_CANNOT_COPY);
    expect(interpretationBlob(view).toLowerCase()).not.toContain("content gap");
    expect(interpretationBlob(view).toLowerCase()).not.toContain("create this page");
  });

  it("F: does not choose a page for an ambiguous relationship", () => {
    const view = inspectionViewFromDecision(
      inspectRecord({
        inspectionState: "ambiguous",
        pageUrl: "https://www.example.com/maybe",
        pageId: null,
        evidenceRefs: [
          {
            kind: "research_idea",
            recordId: "idea-1",
            snapshot: { keyword: "como pintar en seda", gscStatus: "gsc_unavailable" },
          },
          {
            kind: "crawl_run",
            recordId: "crawl-1",
            snapshot: { bounded: false },
          },
          {
            kind: "page",
            recordId: "page-a",
            snapshot: { pageUrl: "https://www.example.com/maybe", title: "Maybe" },
          },
        ],
      }),
    );

    expect(view.pageRelationship).toBe("ambiguous");
    expect(view.pageUrl).toBeNull();
    expect(view.nextStepCopy).toBe(INSPECT_REVIEW_AMBIGUOUS_COPY);
    expect(view.cannotConcludeCopy).toBe(INSPECT_AMBIGUOUS_CANNOT_COPY);
  });

  it("G: does not present a stale crawl generation as current", () => {
    const view = withInspectionCurrency(inspectionViewFromDecision(inspectRecord()), {
      researchCurrent: true,
      latestCrawlId: "crawl-2",
    });
    expect(view.current).toBe(false);
    expect(view.resultCopy).toBe(INSPECT_STATE_COPY.no_obvious_match_in_current_crawl);
    expect(INSPECT_STALE_NEXT_STEP_COPY).toMatch(/earlier evidence/);
  });

  it("H: does not present stale research as a current recommendation", () => {
    const view = withInspectionCurrency(inspectionViewFromDecision(inspectRecord()), {
      researchCurrent: false,
      latestCrawlId: "crawl-1",
    });
    expect(view.current).toBe(false);
    expect(view.nextStepCopy).toBe(INSPECT_REVIEW_SAMPLE_COPY);
  });

  it("I: represents missing GSC as unavailable, never zero demand", () => {
    const view = inspectionViewFromDecision(inspectRecord());
    expect(view.gscAvailable).toBe(false);
    expect(view.gscCopy).toBe(INSPECT_GSC_UNAVAILABLE_COPY);
    expect(view.gscCopy).not.toMatch(/0 impressions|0 clicks|no Google demand/i);
    expect(view.gscCopy).not.toContain("not_in_current_gsc_sample");
  });

  it("J: does not infer coverage from another locale", () => {
    const view = inspectionViewFromDecision(inspectRecord());
    expect(interpretationBlob(view).toLowerCase()).not.toMatch(/english page|parent domain|other locale/);
  });

  it("K: keeps website and idea provenance isolated", () => {
    const first = inspectionViewFromDecision(inspectRecord());
    const second = inspectionViewFromDecision(
      inspectRecord({
        id: "decision-inspect-2",
        websiteId: "website-2",
        evidenceRefs: [
          {
            kind: "research_idea",
            recordId: "idea-2",
            snapshot: { keyword: "other idea", gscStatus: "gsc_unavailable" },
          },
          {
            kind: "crawl_run",
            recordId: "crawl-9",
            snapshot: { bounded: false },
          },
        ],
      }),
    );

    expect(first.websiteId).toBe("website-1");
    expect(first.researchIdeaId).toBe("idea-1");
    expect(second.websiteId).toBe("website-2");
    expect(second.researchIdeaId).toBe("idea-2");
    expect(first.researchIdeaId).not.toBe(second.researchIdeaId);
  });

  it("does not navigate a URL that is not the matching inspected page", () => {
    const view = inspectionViewFromDecision(
      inspectRecord({
        inspectionState: "clear_existing_page_evidence",
        pageId: "page-1",
        pageUrl: "https://unrelated.example/other",
        evidenceRefs: [
          {
            kind: "research_idea",
            recordId: "idea-1",
            snapshot: { keyword: "como pintar en seda", gscStatus: "gsc_unavailable" },
          },
          {
            kind: "page",
            recordId: "page-1",
            snapshot: { pageUrl: "https://www.dbhobby.com/es/seda", title: "Pintura en seda" },
          },
        ],
      }),
    );
    expect(view.pageRelationship).toBe("clear_existing_page");
    expect(view.pageUrl).toBeNull();
    expect(view.pageTitle).toBe("Pintura en seda");
  });

  it("does not invent a page link without matching page evidence", () => {
    const view = inspectionViewFromDecision(
      inspectRecord({
        inspectionState: "clear_existing_page_evidence",
        pageId: "page-1",
        pageUrl: "https://www.dbhobby.com/es/seda",
        evidenceRefs: [
          {
            kind: "research_idea",
            recordId: "idea-1",
            snapshot: { keyword: "como pintar en seda", gscStatus: "gsc_unavailable" },
          },
        ],
      }),
    );
    expect(view.pageRelationship).toBe("clear_existing_page");
    expect(view.pageUrl).toBeNull();
    expect(view.pageTitle).toBeNull();
  });

  it("does not navigate javascript URLs even when a clear match exists", () => {
    const view = inspectionViewFromDecision(
      inspectRecord({
        inspectionState: "clear_existing_page_evidence",
        pageId: "page-1",
        pageUrl: "javascript:alert(1)",
        evidenceRefs: [
          {
            kind: "research_idea",
            recordId: "idea-1",
            snapshot: { keyword: "como pintar en seda", gscStatus: "gsc_unavailable" },
          },
          {
            kind: "page",
            recordId: "page-1",
            snapshot: { pageUrl: "javascript:alert(1)", title: "Unsafe" },
          },
        ],
      }),
    );
    expect(view.pageRelationship).toBe("clear_existing_page");
    expect(view.pageUrl).toBeNull();
  });
});
