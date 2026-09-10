import type {
  ObservationSeverity,
  StoredObservation,
} from "@/lib/observations/types";
import { getImpactScore } from "./config/impact-scores";
import { getConfidenceScore } from "./config/confidence-scores";
import { getRuleRecommendation } from "./config/recommendations";
import { applyPriorityCeiling } from "./scoring/ceiling";
import { calculatePriorityScore } from "./scoring/formula";
import { comparePriorityDrafts } from "./scoring/order";
import {
  buildBrokenLinkTargetCounts,
  calculateReachScore,
} from "./scoring/reach";
import type { PriorityContext, PriorityDraft } from "./types";

type DraftWithSeverity = PriorityDraft & { severity: ObservationSeverity };

export function buildPriorityContext(input: {
  crawlRunId: string;
  websiteId: string;
  totalPagesCrawled: number;
  observations: StoredObservation[];
}): PriorityContext {
  return {
    crawlRunId: input.crawlRunId,
    websiteId: input.websiteId,
    totalPagesCrawled: input.totalPagesCrawled,
    brokenLinkTargetCounts: buildBrokenLinkTargetCounts(input.observations),
  };
}

export function generatePriorityDrafts(input: {
  observations: StoredObservation[];
  context: PriorityContext;
}): PriorityDraft[] {
  const drafts: DraftWithSeverity[] = input.observations.map((observation) => {
    const impactScore = getImpactScore(observation.ruleKey);
    const reach = calculateReachScore(observation, input.context);
    const confidenceScore = getConfidenceScore(observation);
    const recommendation = getRuleRecommendation(observation.ruleKey);

    const rawPriorityScore = calculatePriorityScore({
      impact: impactScore,
      reach: reach.score,
      confidence: confidenceScore,
    });
    const effectivePriority = applyPriorityCeiling({
      rawScore: rawPriorityScore,
      ruleKey: observation.ruleKey,
    });

    return {
      observationId: observation.id,
      ruleKey: observation.ruleKey,
      subjectKey: observation.subjectKey,
      rawPriorityScore: effectivePriority.rawPriorityScore,
      priorityScore: effectivePriority.priorityScore,
      priorityLevel: effectivePriority.priorityLevel,
      priorityCeiling: effectivePriority.priorityCeiling,
      impactScore,
      reachScore: reach.score,
      confidenceScore,
      whyItMatters: recommendation.whyItMatters,
      recommendedAction: recommendation.recommendedAction,
      verification: recommendation.verification,
      explainability: {
        impactReason: `Configured impact score for ${observation.ruleKey}.`,
        reachReason: reach.reason,
        confidenceReason: `Confidence derived from deterministic ${observation.ruleKey} evidence.`,
        affectedPages: reach.affectedPages,
        totalPages: input.context.totalPagesCrawled,
        affectedRatio:
          input.context.totalPagesCrawled > 0
            ? reach.affectedPages / input.context.totalPagesCrawled
            : 0,
        rawPriorityScore: effectivePriority.rawPriorityScore,
        priorityCeiling: effectivePriority.priorityCeiling,
      },
      rank: 0,
      severity: observation.severity,
    };
  });

  drafts.sort(comparePriorityDrafts);

  return drafts.map(({ severity: _severity, ...draft }, index) => ({
    ...draft,
    rank: index + 1,
  }));
}
