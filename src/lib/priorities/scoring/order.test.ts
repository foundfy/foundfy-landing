import { describe, expect, it } from "vitest";
import { comparePriorityDrafts } from "./order";
import type { PriorityDraft } from "../types";

function buildDraft(input: {
  priorityScore: number;
  severity: "info" | "warning" | "error";
  ruleKey: PriorityDraft["ruleKey"];
  subjectKey: string;
}): PriorityDraft & { severity: "info" | "warning" | "error" } {
  return {
    observationId: `obs-${input.subjectKey}`,
    ruleKey: input.ruleKey,
    subjectKey: input.subjectKey,
    rawPriorityScore: input.priorityScore,
    priorityScore: input.priorityScore,
    priorityLevel: "medium",
    priorityCeiling: null,
    impactScore: 50,
    reachScore: 50,
    confidenceScore: 100,
    whyItMatters: "Why",
    recommendedAction: "Action",
    verification: null,
    explainability: {
      impactReason: "Impact",
      reachReason: "Reach",
      confidenceReason: "Confidence",
    },
    rank: 0,
    severity: input.severity,
  };
}

describe("comparePriorityDrafts", () => {
  it("orders by priority score descending", () => {
    const high = buildDraft({
      priorityScore: 90,
      severity: "warning",
      ruleKey: "indexability.noindex",
      subjectKey: "a",
    });
    const low = buildDraft({
      priorityScore: 20,
      severity: "error",
      ruleKey: "indexability.redirecting_url",
      subjectKey: "b",
    });

    expect(comparePriorityDrafts(high, low)).toBeLessThan(0);
  });

  it("uses severity as tie-breaker", () => {
    const errorDraft = buildDraft({
      priorityScore: 60,
      severity: "error",
      ruleKey: "page_fundamentals.missing_title",
      subjectKey: "a",
    });
    const infoDraft = buildDraft({
      priorityScore: 60,
      severity: "info",
      ruleKey: "indexability.redirecting_url",
      subjectKey: "b",
    });

    expect(comparePriorityDrafts(errorDraft, infoDraft)).toBeLessThan(0);
  });

  it("uses stable deterministic tie-breakers for equal scores and severity", () => {
    const left = buildDraft({
      priorityScore: 60,
      severity: "warning",
      ruleKey: "indexability.canonical_missing",
      subjectKey: "page:/a",
    });
    const right = buildDraft({
      priorityScore: 60,
      severity: "warning",
      ruleKey: "indexability.redirecting_url",
      subjectKey: "page:/b",
    });

    expect(comparePriorityDrafts(left, right)).toBeLessThan(0);
    expect(comparePriorityDrafts(left, left)).toBe(0);
  });
});
