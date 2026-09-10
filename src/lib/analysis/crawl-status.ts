export type CrawlLifecycleStatus = "queued" | "running" | "completed" | "failed";

export type PriorityLevel = "critical" | "high" | "medium" | "low";

export type FindingPriority = {
  level: PriorityLevel;
  rank: number;
  whyItMatters: string;
  recommendedAction: string;
  verification: string | null;
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
};

export type FindingsSummary = {
  totalCount: number;
  highlightedFindingIds: string[];
};

export type CrawlStatusPayload = {
  id: string;
  status: CrawlLifecycleStatus;
  hostname: string;
  seedUrl: string;
  maxPages: number;
  pagesCrawled: number;
  pagesDiscovered: number;
  errorMessage: string | null;
  findings?: AnalysisFinding[];
  findingsSummary?: FindingsSummary;
};
