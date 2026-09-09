import type { RedirectHop } from "@/lib/crawler/types";

export type ObservationCategory =
  | "indexability"
  | "page_fundamentals"
  | "internal_structure"
  | "site_discovery";

export type ObservationSeverity = "info" | "warning" | "error";

export type ObservationStatus = "active" | "suppressed" | "resolved";

export type RuleKey =
  | "indexability.non_200_page"
  | "indexability.robots_blocked_url"
  | "indexability.noindex"
  | "indexability.redirecting_url"
  | "indexability.canonical_missing"
  | "indexability.canonical_points_elsewhere"
  | "page_fundamentals.missing_title"
  | "page_fundamentals.duplicate_title"
  | "page_fundamentals.title_length_out_of_range"
  | "page_fundamentals.missing_meta_description"
  | "page_fundamentals.duplicate_meta_description"
  | "page_fundamentals.missing_h1"
  | "page_fundamentals.multiple_h1"
  | "internal_structure.zero_internal_links"
  | "internal_structure.broken_internal_link"
  | "internal_structure.orphan_sitemap_page"
  | "site_discovery.robots_txt_missing"
  | "site_discovery.sitemap_missing"
  | "site_discovery.sitemap_url_issue";

export type RuleDefinition = {
  key: RuleKey;
  category: ObservationCategory;
  severity: ObservationSeverity;
  title: string;
  description: string;
  supported: boolean;
  unsupportedReason?: string;
};

export type ObservationDraft = {
  ruleKey: RuleKey;
  category: ObservationCategory;
  severity: ObservationSeverity;
  title: string;
  description: string;
  pageId?: string | null;
  pageUrl?: string | null;
  subjectKey: string;
  evidence: Record<string, unknown>;
};

export type StoredObservation = ObservationDraft & {
  id: string;
  crawlRunId: string;
  websiteId: string;
  status: ObservationStatus;
  createdAt: string;
  updatedAt: string;
};

export type CrawlPageEvidence = {
  id: string;
  requestedUrl: string;
  finalUrl: string;
  statusCode: number | null;
  redirectChain: RedirectHop[];
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  xRobotsTag: string | null;
  h1: string[];
  internalLinkCount: number;
};

export type CrawlLinkEvidence = {
  id: string;
  fromPageId: string;
  toUrl: string;
  linkType: "internal" | "external";
  anchorText: string | null;
};

export type CrawlQueueEvidence = {
  id: string;
  url: string;
  status: string;
  skipReason: string | null;
};

export type CrawlArtifactEvidence = {
  id: string;
  artifactType: "robots_txt" | "sitemap_xml";
  url: string;
  statusCode: number | null;
  parsed: Record<string, unknown> | null;
};

export type CrawlEvidenceContext = {
  crawlRunId: string;
  websiteId: string;
  hostname: string;
  seedUrl: string;
  pages: CrawlPageEvidence[];
  links: CrawlLinkEvidence[];
  queue: CrawlQueueEvidence[];
  artifacts: CrawlArtifactEvidence[];
};

export const TITLE_LENGTH = {
  minRecommended: 30,
  maxRecommended: 60,
} as const;
