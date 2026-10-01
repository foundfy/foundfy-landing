import type { DecisionRecord, DecisionType } from "./types";

export const SUPPORTED_ACTION_TYPE = "update_meta_description" as const;
export const SUPPORTED_ACTION_FIELD = "meta_description" as const;
export const SUPPORTED_ACTION_RULE_KEY = "page_fundamentals.missing_meta_description" as const;
export const SUPPORTED_ACTION_DECISION_TYPE: DecisionType = "existing_demand_page_issue";

export type SupportedActionType = typeof SUPPORTED_ACTION_TYPE;

export function supportedActionTypeForDecision(
  decision: Pick<DecisionRecord, "decisionType" | "pageId" | "evidenceRefs">,
): SupportedActionType | null {
  if (decision.decisionType !== SUPPORTED_ACTION_DECISION_TYPE || !decision.pageId) {
    return null;
  }

  const observation = decision.evidenceRefs.find((ref) => ref.kind === "observation");
  return observation?.snapshot.ruleKey === SUPPORTED_ACTION_RULE_KEY
    ? SUPPORTED_ACTION_TYPE
    : null;
}
