import { describe, expect, it } from "vitest";
import { applyPriorityCeiling } from "./ceiling";

describe("applyPriorityCeiling", () => {
  it("caps redirecting_url at LOW while preserving the raw score", () => {
    const result = applyPriorityCeiling({
      rawScore: 63,
      ruleKey: "indexability.redirecting_url",
    });

    expect(result.rawPriorityScore).toBe(63);
    expect(result.priorityScore).toBe(34);
    expect(result.priorityLevel).toBe("low");
    expect(result.priorityCeiling).toBe("low");
  });

  it("leaves unrestricted rules unchanged", () => {
    const result = applyPriorityCeiling({
      rawScore: 97,
      ruleKey: "indexability.noindex",
    });

    expect(result.rawPriorityScore).toBe(97);
    expect(result.priorityScore).toBe(97);
    expect(result.priorityLevel).toBe("critical");
    expect(result.priorityCeiling).toBeNull();
  });

  it("caps cosmetic rules at MEDIUM without exceeding the ceiling band", () => {
    const result = applyPriorityCeiling({
      rawScore: 88,
      ruleKey: "page_fundamentals.multiple_h1",
    });

    expect(result.rawPriorityScore).toBe(88);
    expect(result.priorityScore).toBe(59);
    expect(result.priorityLevel).toBe("medium");
    expect(result.priorityCeiling).toBe("medium");
  });
});
