export type FindingRecommendation = {
  whyItMatters: string;
  recommendedAction: string;
  verification: string | null;
};

export type RecommendationInput = {
  ruleKey: string;
  pageUrl: string | null;
  evidence: Record<string, unknown>;
  priorityLevel: "critical" | "high" | "medium" | "low" | null;
};
