import type { CurrentGscSampleStatus } from "@/lib/research/types";
import type { RelatedDemandInspectState } from "./inspect-match";
import type { ResearchInspectDecisionRecord } from "./types";

export type RelatedDemandInspectionView = {
  decisionId: string;
  runId: string;
  state: RelatedDemandInspectState;
  resultCopy: string;
  gscCopy: string;
  crawlBounded: boolean;
  crawlBoundedCopy: string | null;
  nextStepCopy: string;
};

export const INSPECT_RELATED_DEMAND_TYPE = "inspect_related_demand_against_pages" as const;
export const INSPECT_RELATED_DEMAND_ENGINE = "decision_research_inspect_v0" as const;

export const INSPECT_CTA_LABEL = "Check existing pages";
export const INSPECT_NEXT_STEP_COPY = "Review current pages and evidence. Foundfy is not recommending a change yet.";
export const INSPECT_GSC_UNAVAILABLE_COPY =
  "Google Search evidence is not available for this inspection.";
export const INSPECT_BOUNDED_CRAWL_COPY =
  "Foundfy crawled a bounded sample of this site, so pages that were discovered but not fetched are not current page evidence.";
export const INSPECT_GSC_TRUNCATED_COPY =
  "Imported Google Search evidence is bounded, so this comparison uses the queries Foundfy could import.";
export const INSPECT_WHY_COPY =
  "This related external search was returned around the confirmed offering, but current site evidence may or may not clearly identify an existing page.";

export const INSPECT_STATE_COPY: Record<RelatedDemandInspectState, string> = {
  clear_existing_page_evidence:
    "Foundfy found a current crawled page with clear text matching this related search.",
  no_obvious_match_in_current_crawl:
    "Foundfy did not find an obvious match in the current crawl sample.",
  no_obvious_match_after_targeted_observation:
    "Foundfy analyzed the additional page you asked it to check and still did not find an obvious match.",
  ambiguous: "Current site evidence does not point clearly to one page.",
};

export const INSPECT_FORBIDDEN_COPY = [
  "content gap",
  "keyword gap",
  "missing page",
  "does not rank",
  "ranking opportunity",
  "easy win",
  "traffic opportunity",
  "Google wants",
  "create this page",
  "optimize for",
  "should write",
];

export function inspectDecisionTitle(keyword: string): string {
  return `Check whether current pages cover “${keyword}”`;
}

export function inspectGscCopy(status: CurrentGscSampleStatus, truncated: boolean): string {
  if (status === "gsc_unavailable") {
    return INSPECT_GSC_UNAVAILABLE_COPY;
  }

  const sample =
    status === "in_current_gsc_sample"
      ? "This related search is present in the current Google Search sample."
      : "This related search is not present in the current Google Search sample.";
  return truncated ? `${sample} ${INSPECT_GSC_TRUNCATED_COPY}` : sample;
}

export function inspectBoundedCrawlCopy(input: {
  bounded: boolean;
  pagesCrawled?: unknown;
  pagesDiscovered?: unknown;
}): string | null {
  if (!input.bounded) {
    return null;
  }

  const fetched = input.pagesCrawled;
  const discovered = input.pagesDiscovered;
  if (
    typeof fetched === "number" &&
    Number.isFinite(fetched) &&
    typeof discovered === "number" &&
    Number.isFinite(discovered) &&
    discovered > fetched
  ) {
    return `This inspection used the current crawl sample: ${fetched} pages fetched from ${discovered} discovered URLs.`;
  }

  return INSPECT_BOUNDED_CRAWL_COPY;
}

export function inspectExplanation(input: {
  state: RelatedDemandInspectState;
  crawlBounded: boolean;
  pagesCrawled?: unknown;
  pagesDiscovered?: unknown;
  gscCopy: string;
}): string {
  const parts = [
    INSPECT_STATE_COPY[input.state],
    inspectBoundedCrawlCopy({
      bounded: input.crawlBounded,
      pagesCrawled: input.pagesCrawled,
      pagesDiscovered: input.pagesDiscovered,
    }),
    INSPECT_WHY_COPY,
    input.gscCopy,
    INSPECT_NEXT_STEP_COPY,
  ].filter(Boolean);
  return parts.join(" ");
}

export function inspectionViewFromDecision(
  decision: ResearchInspectDecisionRecord,
): RelatedDemandInspectionView {
  const ideaRef = decision.evidenceRefs.find((ref) => ref.kind === "research_idea");
  const crawlRef = decision.evidenceRefs.find((ref) => ref.kind === "crawl_run");
  const state = decision.inspectionState;
  const gscCopy =
    typeof ideaRef?.snapshot.gscCopy === "string"
      ? ideaRef.snapshot.gscCopy
      : inspectGscCopy("gsc_unavailable", false);
  const crawlBoundedCopy = inspectBoundedCrawlCopy({
    bounded: crawlRef?.snapshot.bounded === true,
    pagesCrawled: crawlRef?.snapshot.pagesCrawled,
    pagesDiscovered: crawlRef?.snapshot.pagesDiscovered,
  });
  return {
    decisionId: decision.id,
    runId: decision.decisionRunId,
    state,
    resultCopy: INSPECT_STATE_COPY[state],
    gscCopy,
    crawlBounded: crawlBoundedCopy != null,
    crawlBoundedCopy,
    nextStepCopy: INSPECT_NEXT_STEP_COPY,
  };
}
