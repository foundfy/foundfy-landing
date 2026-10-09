import type { DecisionRecord, DecisionType } from "./types";

export const META_DESCRIPTION_ACTION_TYPE = "update_meta_description" as const;
export const PAGE_TITLE_ACTION_TYPE = "update_page_title" as const;

export const SUPPORTED_ACTION_TYPES = [META_DESCRIPTION_ACTION_TYPE, PAGE_TITLE_ACTION_TYPE] as const;
export type SupportedActionType = (typeof SUPPORTED_ACTION_TYPES)[number];

export const SUPPORTED_ACTION_TYPE = META_DESCRIPTION_ACTION_TYPE;
export const SUPPORTED_ACTION_FIELD = "meta_description" as const;
export const TITLE_ACTION_FIELD = "title" as const;
export const SUPPORTED_ACTION_RULE_KEY = "page_fundamentals.missing_meta_description" as const;
export const MISSING_TITLE_RULE_KEY = "page_fundamentals.missing_title" as const;
export const DUPLICATE_TITLE_RULE_KEY = "page_fundamentals.duplicate_title" as const;
export const TITLE_LENGTH_RULE_KEY = "page_fundamentals.title_length_out_of_range" as const;
export const SUPPORTED_ACTION_DECISION_TYPE: DecisionType = "existing_demand_page_issue";
export const TITLE_GROUP_DECISION_TYPE: DecisionType = "multi_page_issue_with_visibility";

export const TITLE_PRIMARY_REASON = "decision_primary_highest_demand" as const;

export const CANONICAL_REVIEW_TYPE = "review_canonical_target" as const;
export const CANONICAL_ELSEWHERE_RULE_KEY = "indexability.canonical_points_elsewhere" as const;
export const CANONICAL_MISSING_RULE_KEY = "indexability.canonical_missing" as const;
export const SUPPORTED_REVIEW_TYPES = [CANONICAL_REVIEW_TYPE] as const;
export type SupportedReviewType = (typeof SUPPORTED_REVIEW_TYPES)[number];

export function observationRuleKeys(
  decision: Pick<DecisionRecord, "evidenceRefs">,
): string[] {
  return decision.evidenceRefs
    .filter((ref) => ref.kind === "observation")
    .map((ref) => (typeof ref.snapshot.ruleKey === "string" ? ref.snapshot.ruleKey : ""))
    .filter(Boolean);
}

export function supportedActionTypeForDecision(
  decision: Pick<DecisionRecord, "decisionType" | "pageId" | "evidenceRefs">,
): SupportedActionType | null {
  if (!decision.pageId) {
    return null;
  }

  const rules = observationRuleKeys(decision);
  if (rules.length === 0) {
    return null;
  }

  if (decision.decisionType === SUPPORTED_ACTION_DECISION_TYPE) {
    if (rules.includes(SUPPORTED_ACTION_RULE_KEY) && rules.every((rule) => rule === SUPPORTED_ACTION_RULE_KEY)) {
      return META_DESCRIPTION_ACTION_TYPE;
    }
    if (rules.every((rule) => rule === MISSING_TITLE_RULE_KEY || rule === DUPLICATE_TITLE_RULE_KEY)) {
      return PAGE_TITLE_ACTION_TYPE;
    }
    return null;
  }

  if (decision.decisionType === TITLE_GROUP_DECISION_TYPE) {
    if (rules.every((rule) => rule === DUPLICATE_TITLE_RULE_KEY)) {
      return PAGE_TITLE_ACTION_TYPE;
    }
    if (rules.every((rule) => rule === SUPPORTED_ACTION_RULE_KEY)) {
      return META_DESCRIPTION_ACTION_TYPE;
    }
    return null;
  }

  return null;
}

export function supportedActionField(actionType: SupportedActionType): "meta_description" | "title" {
  return actionType === PAGE_TITLE_ACTION_TYPE ? TITLE_ACTION_FIELD : SUPPORTED_ACTION_FIELD;
}

export function supportedReviewTypeForDecision(
  decision: Pick<DecisionRecord, "decisionType" | "evidenceRefs">,
): SupportedReviewType | null {
  if (decision.decisionType !== SUPPORTED_ACTION_DECISION_TYPE) {
    return null;
  }

  const rules = observationRuleKeys(decision);
  if (rules.length === 0) {
    return null;
  }

  if (rules.every((rule) => rule === CANONICAL_ELSEWHERE_RULE_KEY)) {
    return CANONICAL_REVIEW_TYPE;
  }

  return null;
}
