import type { RuleKey } from "@/lib/observations/types";

export type FindingChangeStatus = "new" | "still_present";

export type FixedFindingSnapshot = {
  ruleKey: RuleKey;
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

export type CrawlCoverage = {
  crawledPageUrls: Set<string>;
  requestedToFinal: Map<string, string>;
  outgoingLinksBySource: Map<string, Set<string>>;
  targetStatusByUrl: Map<string, number | null>;
  queuedUrls: Set<string>;
  sitemapUrls: Set<string>;
};
