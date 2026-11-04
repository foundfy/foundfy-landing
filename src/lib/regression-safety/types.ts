export const REGRESSION_SAFETY_FIELDS = [
  "title",
  "meta_description",
  "canonical",
  "robots_meta",
  "og_description",
  "og_image",
  "og_image_alt",
  "twitter_description",
  "twitter_image",
  "twitter_image_alt",
  "twitter_card",
] as const;

export type RegressionSafetyField = (typeof REGRESSION_SAFETY_FIELDS)[number];

export type FieldPresence = "present" | "absent" | "unknown";

export type ObservedField = {
  presence: FieldPresence;
  value: string | null;
};

export type PageMetadataEvidence = {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number | null;
  fields: Record<RegressionSafetyField, ObservedField>;
};

export type CrawlMetadataSnapshot = {
  websiteId: string;
  crawlRunId: string;
  status: string;
  pagesCrawled: number;
  completedAt: string | null;
  pages: PageMetadataEvidence[];
  findings?: Array<{
    ruleKey: string;
    pageUrl?: string | null;
  }>;
};

export type ExpectedFieldChange = {
  url: string;
  field: RegressionSafetyField;
  after: string;
};

export type ManualSeoImprovementSpec = {
  websiteId: string;
  urls: string[];
  baseline: CrawlMetadataSnapshot;
  verification: CrawlMetadataSnapshot;
  expectedChanges: ExpectedFieldChange[];
  preserveFields?: RegressionSafetyField[];
  originalFindingRuleKey?: string;
};

export type FieldCheckOutcome = "unchanged" | "changed" | "removed" | "missing" | "unknown";

export type FieldCheck = {
  url: string;
  field: RegressionSafetyField;
  role: "expected_change" | "related" | "preserve";
  outcome: FieldCheckOutcome;
  before: ObservedField;
  after: ObservedField;
  result: "pass" | "fail" | "not_verified";
  note: string;
};

export type UrlMatch = {
  url: string;
  matched: boolean;
};

export type OriginalIssueStatus = "resolved" | "still_present" | "not_verified";

export type RegressionSafetyVerdict = "pass" | "fail" | "not_verified";

export type RegressionSafetyReport = {
  verdict: RegressionSafetyVerdict;
  websiteId: string;
  urls: UrlMatch[];
  baselineCrawlId: string;
  baselineCompletedAt: string | null;
  verificationCrawlId: string;
  verificationCompletedAt: string | null;
  originalIssueStatus: OriginalIssueStatus | null;
  checks: FieldCheck[];
  limitations: string[];
  summary: string;
};
