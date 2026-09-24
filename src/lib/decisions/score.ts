import {
  DECISION_TYPE_B_MIN_SHARE,
  ISSUE_IMPORTANCE_BY_LEVEL,
  ISSUE_IMPORTANCE_BY_SEVERITY,
} from "./config";
import type {
  DecisionConfidence,
  DecisionScoring,
  GscPageEvidenceInput,
  ObservationInput,
} from "./types";

const MULTI_PAGE_RULES = new Set([
  "page_fundamentals.duplicate_title",
  "page_fundamentals.duplicate_meta_description",
]);

const ACTIONABLE_SEVERITIES = new Set(["error", "warning"]);

export function isActionablePageObservation(observation: ObservationInput): boolean {
  if (observation.status !== "active" || !observation.pageId) {
    return false;
  }

  if (!ACTIONABLE_SEVERITIES.has(observation.severity)) {
    return false;
  }

  return !observation.ruleKey.startsWith("site_discovery.");
}

export function isMultiPageObservation(observation: ObservationInput): boolean {
  return MULTI_PAGE_RULES.has(observation.ruleKey);
}

export function issueImportance(observation: ObservationInput | null): number {
  if (!observation) {
    return 20;
  }

  if (observation.priorityLevel) {
    return ISSUE_IMPORTANCE_BY_LEVEL[observation.priorityLevel];
  }

  return ISSUE_IMPORTANCE_BY_SEVERITY[observation.severity];
}

export function searchDemandScore(
  page: Pick<GscPageEvidenceInput, "clicks" | "impressions">,
  maxImpressions: number,
): number {
  if (maxImpressions <= 0) {
    return 0;
  }

  const ratio = page.impressions / maxImpressions;
  const clickBoost = page.clicks > 0 ? 15 : 0;
  return Math.min(100, Math.round(ratio * 85 + clickBoost));
}

export function hasAnySearchDemand(
  page: Pick<GscPageEvidenceInput, "clicks" | "impressions">,
): boolean {
  return page.impressions > 0 || page.clicks > 0;
}

export function hasMeaningfulVisibility(
  page: Pick<GscPageEvidenceInput, "clicks" | "impressions">,
  maxImpressions: number,
): boolean {
  if (!hasAnySearchDemand(page)) {
    return false;
  }

  if (maxImpressions <= 0) {
    return page.clicks > 0;
  }

  return page.clicks > 0 || page.impressions / maxImpressions >= DECISION_TYPE_B_MIN_SHARE;
}

export function evidenceConfidenceScore(input: {
  mapped: boolean;
  truncated: boolean;
}): { score: number; confidence: DecisionConfidence } {
  if (!input.mapped) {
    return { score: 60, confidence: "unmapped_page" };
  }

  if (input.truncated) {
    return { score: 70, confidence: "bounded_dataset" };
  }

  return { score: 90, confidence: "exact_match" };
}

export function combineScoring(input: {
  issueImportance: number;
  searchDemand: number;
  evidenceConfidence: number;
}): DecisionScoring {
  const total = Math.round(
    input.issueImportance * 0.45 + input.searchDemand * 0.4 + input.evidenceConfidence * 0.15,
  );

  return {
    issueImportance: input.issueImportance,
    searchDemand: input.searchDemand,
    evidenceConfidence: input.evidenceConfidence,
    total,
  };
}

export function bandForRank(rank: number): "do_first" | "next" | "later" {
  if (rank === 1) {
    return "do_first";
  }

  if (rank <= 3) {
    return "next";
  }

  return "later";
}
