import type {
  AnalysisFinding,
  CrawlComparison,
  CrawlLifecycleStatus,
  FindingsSummary,
  SearchPresenceSignals,
} from "@/lib/analysis/crawl-status";
import type { WebsiteGoalsRecord } from "@/lib/goals/types";
import type { SiteModelRecord } from "@/lib/site-model/types";

export type WebsiteRecord = {
  id: string;
  hostname: string;
  displayUrl: string;
  firstSeenAt: string;
  lastCrawledAt: string | null;
};

export type WebsiteCrawlRunRecord = {
  id: string;
  websiteId: string;
  status: CrawlLifecycleStatus;
  seedUrl: string;
  pagesCrawled: number;
  maxPages: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ScanHistoryItem = {
  crawlRunId: string;
  status: CrawlLifecycleStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  pagesCrawled: number;
  findingsCount: number | null;
};

export type WebsiteOverview = {
  website: WebsiteRecord;
  latestUsableScan: {
    crawlRunId: string;
    completedAt: string;
    pagesCrawled: number;
    findings: AnalysisFinding[];
    findingsSummary: FindingsSummary;
    comparison: CrawlComparison | null;
    searchPresence: SearchPresenceSignals | null;
    explanationEnrichmentStatus:
      | "disabled"
      | "skipped"
      | "pending"
      | "ready"
      | "failed";
  } | null;
  highlightedFindings: AnalysisFinding[];
  siteModel: SiteModelRecord | null;
  goals: WebsiteGoalsRecord | null;
  activeScan: {
    crawlRunId: string;
    status: "queued" | "running";
    pagesCrawled: number;
    maxPages: number;
  } | null;
  scanHistory: ScanHistoryItem[];
};

export const WEBSITE_SCAN_HISTORY_LIMIT = 50;
