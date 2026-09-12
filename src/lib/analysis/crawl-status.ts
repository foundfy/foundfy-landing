import type { SearchPresenceSignals } from "./search-presence";

export type { SearchPresenceSignals };

export type CrawlLifecycleStatus = "queued" | "running" | "completed" | "failed";

export type PriorityLevel = "critical" | "high" | "medium" | "low";

export type FindingPriority = {
  level: PriorityLevel;
  rank: number;
  whyItMatters: string;
  recommendedAction: string;
  verification: string | null;
};

export type FindingRecommendation = {
  whyItMatters: string;
  recommendedAction: string;
  verification: string | null;
};

export type FindingExplanationEnrichment = {
  contextualExplanation: string;
  evidenceExplanation: string;
  citedEvidenceKeys: string[];
};

export type HighlightAggregation = {
  affectedPageCount: number;
};

export type FindingChangeStatus = "new" | "still_present";

export type FixedFindingSnapshot = {
  ruleKey: string;
  title: string;
  pageUrl: string | null;
};

export type CrawlComparisonSummary = {
  previousCrawlRunId: string;
  previousCompletedAt: string;
  fixed: number;
  stillPresent: number;
  new: number;
  unverified: number;
};

export type CrawlComparison = CrawlComparisonSummary & {
  fixedFindings: FixedFindingSnapshot[];
};

export type AnalysisFinding = {
  id: string;
  ruleKey: string;
  category: string;
  severity: "info" | "warning" | "error";
  title: string;
  description: string;
  pageUrl: string | null;
  evidence: Record<string, unknown>;
  priority: FindingPriority | null;
  recommendation?: FindingRecommendation | null;
  explanationEnrichment?: FindingExplanationEnrichment | null;
  highlightAggregation?: HighlightAggregation | null;
  changeStatus?: FindingChangeStatus;
};

export type HighlightGroupSummary = {
  representativeFindingId: string;
  memberFindingIds: string[];
  rawFindingCount: number;
  affectedPageCount: number;
};

export type FindingsSummary = {
  totalCount: number;
  highlightedFindingIds: string[];
  highlightGroups: HighlightGroupSummary[];
};

export type CrawlStatusPayload = {
  id: string;
  websiteId: string;
  status: CrawlLifecycleStatus;
  hostname: string;
  seedUrl: string;
  maxPages: number;
  pagesCrawled: number;
  pagesDiscovered: number;
  errorMessage: string | null;
  findings?: AnalysisFinding[];
  findingsSummary?: FindingsSummary;
  comparison?: CrawlComparison;
  searchPresence?: SearchPresenceSignals;
  explanationEnrichmentStatus?:
    | "disabled"
    | "skipped"
    | "pending"
    | "ready"
    | "failed";
};
