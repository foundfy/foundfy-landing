import { describe, expect, it } from "vitest";
import { RULE_DEFINITIONS } from "@/lib/observations/rules";
import type { RuleKey } from "@/lib/observations/types";
import { BASE_CONFIDENCE_SCORES } from "./confidence-scores";
import { IMPACT_SCORES } from "./impact-scores";
import { RULE_RECOMMENDATIONS } from "./recommendations";
import { REACH_STRATEGIES } from "../scoring/reach";

const SUPPORTED_RULE_KEYS = Object.entries(RULE_DEFINITIONS)
  .filter(([, definition]) => definition.supported)
  .map(([key]) => key as RuleKey);

describe("priority rule mappings", () => {
  it("defines impact, reach, confidence, and recommendations for every supported rule", () => {
    for (const ruleKey of SUPPORTED_RULE_KEYS) {
      expect(IMPACT_SCORES[ruleKey]).toBeTypeOf("number");
      expect(BASE_CONFIDENCE_SCORES[ruleKey]).toBeTypeOf("number");
      expect(REACH_STRATEGIES[ruleKey]).toBeTypeOf("string");
      expect(RULE_RECOMMENDATIONS[ruleKey]?.whyItMatters.length).toBeGreaterThan(0);
      expect(RULE_RECOMMENDATIONS[ruleKey]?.recommendedAction.length).toBeGreaterThan(0);
    }
  });

  it("keeps impact scores within 0-100", () => {
    for (const ruleKey of SUPPORTED_RULE_KEYS) {
      const score = IMPACT_SCORES[ruleKey];
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
