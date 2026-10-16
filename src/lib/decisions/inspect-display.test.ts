import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  INSPECT_CTA_LABEL,
  INSPECT_FORBIDDEN_COPY,
  INSPECT_GSC_UNAVAILABLE_COPY,
  INSPECT_STATE_COPY,
  inspectBoundedCrawlCopy,
  inspectDecisionTitle,
  inspectExplanation,
  inspectGscCopy,
  inspectionViewFromDecision,
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
      INSPECT_STATE_COPY.ambiguous,
      INSPECT_GSC_UNAVAILABLE_COPY,
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
    const ambiguous = inspectionViewFromDecision({
      ...base,
      inspectionState: "ambiguous",
    });

    expect(clear.state).toBe("clear_existing_page_evidence");
    expect(clear.resultCopy).toBe(INSPECT_STATE_COPY.clear_existing_page_evidence);
    expect(noMatch.state).toBe("no_obvious_match_in_current_crawl");
    expect(noMatch.resultCopy).toBe(INSPECT_STATE_COPY.no_obvious_match_in_current_crawl);
    expect(ambiguous.state).toBe("ambiguous");
    expect(ambiguous.resultCopy).toBe(INSPECT_STATE_COPY.ambiguous);

    for (const view of [clear, noMatch, ambiguous]) {
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
  });
});
