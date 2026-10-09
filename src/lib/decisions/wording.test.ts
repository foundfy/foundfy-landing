import { describe, expect, it } from "vitest";
import { IMPACT_SCORES } from "@/lib/priorities/config/impact-scores";
import { BASE_CONFIDENCE_SCORES } from "@/lib/priorities/config/confidence-scores";
import { buildRankedDecisions } from "./candidates";
import {
  supportedActionTypeForDecision,
  supportedReviewTypeForDecision,
} from "./supported-action";
import { combineScoring, issueImportance } from "./score";
import type {
  DecisionEngineInput,
  GscPageEvidenceInput,
  ObservationInput,
} from "./types";
import { actionTitleForRule, pageIssueExplanation } from "./wording";

const MUTATION_LANGUAGE = /add an h1|reduce h1|insert|dom|cms field|component|demote/i;
const SUGGESTED_H1_VALUE = /pintura en seda|this should be the heading/i;

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
    ruleKey: "page_fundamentals.missing_h1",
    title: "No main heading",
    description: "Foundfy did not find an H1 heading on the page.",
    severity: "warning",
    status: "active",
    evidence: {},
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

describe("H1 Decision wording", () => {
  it("uses review language for missing H1 titles", () => {
    expect(
      actionTitleForRule(
        "page_fundamentals.missing_h1",
        "https://www.dbhobby.com/es/pintura-en-seda",
      ),
    ).toBe("Review the main heading on /es/pintura-en-seda");
  });

  it("uses review language for multiple H1 titles", () => {
    expect(
      actionTitleForRule("page_fundamentals.multiple_h1", "https://www.dbhobby.com/es/pintura-en-seda"),
    ).toBe("Review the main headings on /es/pintura-en-seda");
  });

  it("keeps meta, title, and canonical Decision titles unchanged", () => {
    expect(
      actionTitleForRule(
        "page_fundamentals.missing_meta_description",
        "https://www.dbhobby.com/",
      ),
    ).toBe("Add a meta description on /");
    expect(
      actionTitleForRule("page_fundamentals.missing_title", "https://www.dbhobby.com/es/pintura-en-seda"),
    ).toBe("Improve the page title on /es/pintura-en-seda");
    expect(
      actionTitleForRule(
        "indexability.canonical_points_elsewhere",
        "https://www.dbhobby.com/es",
      ),
    ).toBe("Review the canonical URL on /es");
  });

  it("does not suggest an H1 value or insertion point", () => {
    const missing = pageIssueExplanation("No main heading", "page_fundamentals.missing_h1");
    const multiple = pageIssueExplanation(
      "More than one main heading",
      "page_fundamentals.multiple_h1",
    );

    expect(missing).toContain("already appears in Google Search");
    expect(missing).toContain("did not find an H1 heading");
    expect(missing).toContain("does not yet know where a heading should safely be added");
    expect(missing).not.toMatch(MUTATION_LANGUAGE);
    expect(missing).not.toMatch(SUGGESTED_H1_VALUE);

    expect(multiple).toContain("already appears in Google Search");
    expect(multiple).toContain("more than one H1 heading");
    expect(multiple).toContain("Check which heading should represent the page's main topic");
    expect(multiple).not.toMatch(MUTATION_LANGUAGE);
    expect(multiple).not.toMatch(/which h1 to remove|remove the second/i);
  });
});

describe("H1 Type A Decision generation", () => {
  it("keeps GSC demand, score, rank, and page identity for missing H1", () => {
    const gscPage = page({
      id: "gsc-1",
      pageUrl: "https://www.dbhobby.com/es/pintura-en-seda",
      pageId: "page-1",
      impressions: 51,
      clicks: 5,
    });
    const missingH1 = observation({ id: "obs-h1" });
    const decisions = rank([gscPage], [missingH1]);
    const scoring = combineScoring({
      issueImportance: issueImportance(missingH1),
      searchDemand: 100,
      evidenceConfidence: 90,
    });

    expect(decisions).toHaveLength(1);
    expect(decisions[0].decisionType).toBe("existing_demand_page_issue");
    expect(decisions[0].title).toBe("Review the main heading on /es/pintura-en-seda");
    expect(decisions[0].pageUrl).toBe("https://www.dbhobby.com/es/pintura-en-seda");
    expect(decisions[0].pageId).toBe("page-1");
    expect(decisions[0].rank).toBe(1);
    expect(decisions[0].scoring).toEqual(scoring);
    expect(decisions[0].explanation).toContain("already appears in Google Search");
    expect(decisions[0].explanation).not.toMatch(MUTATION_LANGUAGE);
    expect(decisions[0].explanation).not.toMatch(SUGGESTED_H1_VALUE);
    expect(decisions[0].evidenceRefs.some((ref) => ref.kind === "gsc_evidence" && ref.recordId === "gsc-1")).toBe(
      true,
    );
    expect(supportedActionTypeForDecision(decisions[0])).toBeNull();
    expect(supportedReviewTypeForDecision(decisions[0])).toBeNull();
  });

  it("keeps scoring config for H1 rules unchanged", () => {
    expect(IMPACT_SCORES["page_fundamentals.missing_h1"]).toBe(55);
    expect(IMPACT_SCORES["page_fundamentals.multiple_h1"]).toBe(35);
    expect(BASE_CONFIDENCE_SCORES["page_fundamentals.missing_h1"]).toBe(100);
    expect(BASE_CONFIDENCE_SCORES["page_fundamentals.multiple_h1"]).toBe(100);
  });
});
