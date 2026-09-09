export type CrawlLifecycleStatus = "queued" | "running" | "completed" | "failed";

export type AnalysisObservation = {
  id: string;
  ruleKey: string;
  category: string;
  severity: "info" | "warning" | "error";
  title: string;
  description: string;
  pageUrl: string | null;
  evidence: Record<string, unknown>;
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
  observations?: AnalysisObservation[];
};
