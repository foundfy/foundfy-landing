import type { RuleKey } from "@/lib/observations/types";

export type PriorityLevel = "critical" | "high" | "medium" | "low";

export type PriorityStatus = "active" | "suppressed" | "resolved";

export type PriorityExplainability = {
  impactReason: string;
  reachReason: string;
  confidenceReason: string;
  affectedPages?: number;
  totalPages?: number;
  affectedRatio?: number;
  rawPriorityScore?: number;
  priorityCeiling?: PriorityLevel | null;
};

export type PriorityDraft = {
  observationId: string;
  ruleKey: RuleKey;
  subjectKey: string;
  rawPriorityScore: number;
  priorityScore: number;
  priorityLevel: PriorityLevel;
  priorityCeiling: PriorityLevel | null;
  impactScore: number;
  reachScore: number;
  confidenceScore: number;
  whyItMatters: string;
  recommendedAction: string;
  verification: string | null;
  explainability: PriorityExplainability;
  rank: number;
};

export type StoredPriority = PriorityDraft & {
  id: string;
  crawlRunId: string;
  websiteId: string;
  status: PriorityStatus;
  createdAt: string;
  updatedAt: string;
};

export type PriorityContext = {
  crawlRunId: string;
  websiteId: string;
  totalPagesCrawled: number;
  brokenLinkTargetCounts: Map<string, number>;
};
