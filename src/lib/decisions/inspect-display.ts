import type { CurrentGscSampleStatus } from "@/lib/research/types";
import type { RelatedDemandInspectState } from "./inspect-match";
import type { DecisionEvidenceRef, ResearchInspectDecisionRecord } from "./types";

export type InspectPageRelationship =
  | "clear_existing_page"
  | "none_in_crawl_sample"
  | "none_after_targeted_observation"
  | "ambiguous";

export type RelatedDemandInspectionView = {
  decisionId: string;
  runId: string;
  websiteId: string;
  researchIdeaId: string | null;
  crawlRunId: string | null;
  targetedObservationId: string | null;
  state: RelatedDemandInspectState;
  pageRelationship: InspectPageRelationship;
  opportunityCopy: string;
  pageRelationshipCopy: string;
  pageUrl: string | null;
  pageTitle: string | null;
  resultCopy: string;
  evidenceCopy: string;
  limitationCopy: string | null;
  cannotConcludeCopy: string;
  gscCopy: string;
  gscAvailable: boolean;
  crawlBounded: boolean;
  crawlBoundedCopy: string | null;
  nextStepCopy: string;
  current: boolean;
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

export const INSPECT_OPPORTUNITY_LABEL = "Search opportunity";
export const INSPECT_PAGES_LABEL = "Pages Foundfy checked";
export const INSPECT_EVIDENCE_LABEL = "What the evidence means";
export const INSPECT_NEXT_REVIEW_LABEL = "What to review next";

export const INSPECT_REVIEW_PAGE_COPY =
  "Review whether this page adequately addresses what the searcher would expect. Foundfy is not recommending a change yet.";
export const INSPECT_REVIEW_SAMPLE_COPY =
  "Review the current crawl sample. Foundfy is not recommending a new page.";
export const INSPECT_REVIEW_AFTER_OBSERVE_COPY =
  "Review the additional page you asked Foundfy to check. Foundfy is not recommending a new page.";
export const INSPECT_REVIEW_AMBIGUOUS_COPY =
  "Review the current pages and evidence. Foundfy is not choosing a page or recommending a change.";
export const INSPECT_STALE_NEXT_STEP_COPY =
  "This inspection is from earlier evidence. Check existing pages again before treating it as current.";

export const INSPECT_CLEAR_EVIDENCE_COPY =
  "Foundfy identified this page from crawled text. Search Console performance is a separate question.";
export const INSPECT_NO_MATCH_EVIDENCE_COPY =
  "Foundfy compared this search with fetched pages in the current crawl sample.";
export const INSPECT_T1_NO_MATCH_EVIDENCE_COPY =
  "Foundfy compared this search with the original crawled pages plus the additional page you asked it to check.";
export const INSPECT_AMBIGUOUS_EVIDENCE_COPY =
  "The current site evidence does not point clearly to one page.";

export const INSPECT_CLEAR_CANNOT_COPY =
  "A text match does not mean this page needs optimization, has the wrong search intent, or is the best landing page.";
export const INSPECT_NO_MATCH_CANNOT_COPY =
  "This check covers fetched pages in the current crawl sample, not the whole site. Foundfy is not recommending that you add content.";
export const INSPECT_T1_NO_MATCH_CANNOT_COPY =
  "Checking one additional page does not prove a sitewide gap, and Foundfy is not recommending that you add content.";
export const INSPECT_AMBIGUOUS_CANNOT_COPY =
  "Foundfy is not selecting a page or recommending a change from this mixed evidence.";

export const INSPECT_STATE_COPY: Record<RelatedDemandInspectState, string> = {
  clear_existing_page_evidence:
    "Foundfy found a current crawled page with clear text matching this related search.",
  no_obvious_match_in_current_crawl:
    "Foundfy did not find an obvious match in the current crawl sample.",
  no_obvious_match_after_targeted_observation:
    "Foundfy analyzed the additional page you asked it to check and still did not find an obvious match.",
  ambiguous: "Current site evidence does not point clearly to one page.",
};

export const INSPECT_PAGE_RELATIONSHIP: Record<
  RelatedDemandInspectState,
  InspectPageRelationship
> = {
  clear_existing_page_evidence: "clear_existing_page",
  no_obvious_match_in_current_crawl: "none_in_crawl_sample",
  no_obvious_match_after_targeted_observation: "none_after_targeted_observation",
  ambiguous: "ambiguous",
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

export function inspectNextStepCopy(state: RelatedDemandInspectState): string {
  if (state === "clear_existing_page_evidence") {
    return INSPECT_REVIEW_PAGE_COPY;
  }
  if (state === "no_obvious_match_in_current_crawl") {
    return INSPECT_REVIEW_SAMPLE_COPY;
  }
  if (state === "no_obvious_match_after_targeted_observation") {
    return INSPECT_REVIEW_AFTER_OBSERVE_COPY;
  }
  return INSPECT_REVIEW_AMBIGUOUS_COPY;
}

export function inspectEvidenceCopy(state: RelatedDemandInspectState): string {
  if (state === "clear_existing_page_evidence") {
    return INSPECT_CLEAR_EVIDENCE_COPY;
  }
  if (state === "no_obvious_match_in_current_crawl") {
    return INSPECT_NO_MATCH_EVIDENCE_COPY;
  }
  if (state === "no_obvious_match_after_targeted_observation") {
    return INSPECT_T1_NO_MATCH_EVIDENCE_COPY;
  }
  return INSPECT_AMBIGUOUS_EVIDENCE_COPY;
}

export function inspectCannotConcludeCopy(state: RelatedDemandInspectState): string {
  if (state === "clear_existing_page_evidence") {
    return INSPECT_CLEAR_CANNOT_COPY;
  }
  if (state === "no_obvious_match_in_current_crawl") {
    return INSPECT_NO_MATCH_CANNOT_COPY;
  }
  if (state === "no_obvious_match_after_targeted_observation") {
    return INSPECT_T1_NO_MATCH_CANNOT_COPY;
  }
  return INSPECT_AMBIGUOUS_CANNOT_COPY;
}

export function withInspectionCurrency(
  view: RelatedDemandInspectionView,
  input: { researchCurrent: boolean; latestCrawlId: string | null },
): RelatedDemandInspectionView {
  const current =
    input.researchCurrent &&
    input.latestCrawlId != null &&
    view.crawlRunId === input.latestCrawlId;
  return { ...view, current };
}

function refOfKind(
  refs: DecisionEvidenceRef[],
  kind: DecisionEvidenceRef["kind"],
): DecisionEvidenceRef | undefined {
  return refs.find((ref) => ref.kind === kind);
}

function snapshotString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isNavigableHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function supportedInspectPage(decision: ResearchInspectDecisionRecord): {
  pageUrl: string | null;
  pageTitle: string | null;
} {
  if (decision.inspectionState !== "clear_existing_page_evidence" || !decision.pageId) {
    return { pageUrl: null, pageTitle: null };
  }

  const pageRef = decision.evidenceRefs.find(
    (ref) => ref.kind === "page" && ref.recordId === decision.pageId,
  );
  if (!pageRef) {
    return { pageUrl: null, pageTitle: null };
  }

  const fromSnapshot = snapshotString(pageRef.snapshot.pageUrl);
  const fromDecision = snapshotString(decision.pageUrl);
  if (fromSnapshot && fromDecision && fromSnapshot !== fromDecision) {
    return { pageUrl: null, pageTitle: snapshotString(pageRef.snapshot.title) };
  }

  const pageUrl = fromSnapshot ?? fromDecision;
  if (!pageUrl || !isNavigableHttpUrl(pageUrl)) {
    return { pageUrl: null, pageTitle: snapshotString(pageRef.snapshot.title) };
  }

  return {
    pageUrl,
    pageTitle: snapshotString(pageRef.snapshot.title),
  };
}

function gscAvailableFromDecision(decision: ResearchInspectDecisionRecord): boolean {
  const ideaRef = refOfKind(decision.evidenceRefs, "research_idea");
  const status = ideaRef?.snapshot.gscStatus;
  if (status === "gsc_unavailable") {
    return false;
  }
  if (status === "in_current_gsc_sample" || status === "not_in_current_gsc_sample") {
    return true;
  }
  return decision.evidenceRefs.some((ref) => ref.kind === "gsc_sync");
}

export function inspectionViewFromDecision(
  decision: ResearchInspectDecisionRecord,
): RelatedDemandInspectionView {
  const ideaRef = refOfKind(decision.evidenceRefs, "research_idea");
  const crawlRef = refOfKind(decision.evidenceRefs, "crawl_run");
  const observationRef = refOfKind(decision.evidenceRefs, "targeted_observation");
  const state = decision.inspectionState;
  const keyword = snapshotString(ideaRef?.snapshot.keyword);
  const gscCopy =
    snapshotString(ideaRef?.snapshot.gscCopy) ?? inspectGscCopy("gsc_unavailable", false);
  const crawlBoundedCopy = inspectBoundedCrawlCopy({
    bounded: crawlRef?.snapshot.bounded === true,
    pagesCrawled: crawlRef?.snapshot.pagesCrawled,
    pagesDiscovered: crawlRef?.snapshot.pagesDiscovered,
  });
  const page = supportedInspectPage(decision);

  return {
    decisionId: decision.id,
    runId: decision.decisionRunId,
    websiteId: decision.websiteId,
    researchIdeaId: ideaRef?.recordId ?? null,
    crawlRunId: crawlRef?.recordId ?? null,
    targetedObservationId: observationRef?.recordId ?? null,
    state,
    pageRelationship: INSPECT_PAGE_RELATIONSHIP[state],
    opportunityCopy: keyword ? inspectDecisionTitle(keyword) : decision.title,
    pageRelationshipCopy: INSPECT_STATE_COPY[state],
    pageUrl: page.pageUrl,
    pageTitle: page.pageTitle,
    resultCopy: INSPECT_STATE_COPY[state],
    evidenceCopy: inspectEvidenceCopy(state),
    limitationCopy: crawlBoundedCopy,
    cannotConcludeCopy: inspectCannotConcludeCopy(state),
    gscCopy,
    gscAvailable: gscAvailableFromDecision(decision),
    crawlBounded: crawlBoundedCopy != null,
    crawlBoundedCopy,
    nextStepCopy: inspectNextStepCopy(state),
    current: true,
  };
}
