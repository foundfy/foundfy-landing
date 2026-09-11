import {
  formatComparisonNarrative,
  formatFirstScanProgressCopy,
} from "@/lib/analysis/comparison-display";
import {
  formatEmptyHighlightsCopy,
  formatZeroFindingsCopy,
} from "@/lib/analysis/finding-display";
import type {
  AnalysisFinding,
  CrawlComparison,
  CrawlLifecycleStatus,
  FindingsSummary,
} from "@/lib/analysis/crawl-status";
import type { ScanHistoryItem, WebsiteOverview } from "@/lib/websites/types";

export const SITE_HIGHLIGHT_MAX = 3;

export type SiteOverviewLinks = {
  latestScanHref: string | null;
  activeScanHref: string | null;
  historyHrefs: string[];
};

export type SiteProgressContent =
  | { kind: "first_scan"; copy: string }
  | { kind: "comparison"; copy: string; comparison: CrawlComparison };

export type SiteWhatMattersContent =
  | { kind: "highlights"; findings: AnalysisFinding[] }
  | { kind: "empty_highlights"; title: string; description: string }
  | { kind: "zero_findings"; title: string; description: string }
  | { kind: "no_scan"; title: string; description: string };

export function buildSiteOverviewLinks(overview: WebsiteOverview): SiteOverviewLinks {
  return {
    latestScanHref: overview.latestUsableScan
      ? `/scan/${overview.latestUsableScan.crawlRunId}`
      : null,
    activeScanHref: overview.activeScan
      ? `/scan/${overview.activeScan.crawlRunId}`
      : null,
    historyHrefs: overview.scanHistory.map((item) => `/scan/${item.crawlRunId}`),
  };
}

export function buildHighlightedFindingsForSitePage(
  findings: AnalysisFinding[],
  findingsSummary: FindingsSummary,
): AnalysisFinding[] {
  const highlightGroupByRepresentativeId = new Map(
    findingsSummary.highlightGroups.map((group) => [
      group.representativeFindingId,
      group,
    ]),
  );

  return findingsSummary.highlightedFindingIds
    .slice(0, SITE_HIGHLIGHT_MAX)
    .map((findingId) => {
      const finding = findings.find((item) => item.id === findingId);
      if (!finding) {
        return undefined;
      }

      const group = highlightGroupByRepresentativeId.get(findingId);
      if (!group || group.affectedPageCount <= 1) {
        return finding;
      }

      return {
        ...finding,
        highlightAggregation: {
          affectedPageCount: group.affectedPageCount,
        },
      };
    })
    .filter((finding): finding is AnalysisFinding => finding !== undefined);
}

export function buildSiteProgressContent(
  comparison: CrawlComparison | null | undefined,
): SiteProgressContent {
  if (!comparison) {
    return { kind: "first_scan", copy: formatFirstScanProgressCopy() };
  }

  return {
    kind: "comparison",
    copy: formatComparisonNarrative(comparison),
    comparison,
  };
}

export function buildSiteWhatMattersContent(
  overview: WebsiteOverview,
): SiteWhatMattersContent {
  if (!overview.latestUsableScan) {
    return {
      kind: "no_scan",
      title: "No successful scan yet",
      description:
        "Run a scan to see what matters for this site. Failed or in-progress scans do not replace a successful baseline.",
    };
  }

  const { findingsSummary } = overview.latestUsableScan;
  const totalCount = findingsSummary.totalCount;

  if (totalCount === 0) {
    const zeroCopy = formatZeroFindingsCopy();
    return {
      kind: "zero_findings",
      title: zeroCopy.title,
      description: zeroCopy.description,
    };
  }

  const highlights = buildHighlightedFindingsForSitePage(
    overview.highlightedFindings,
    findingsSummary,
  );

  if (highlights.length === 0) {
    const emptyCopy = formatEmptyHighlightsCopy();
    return {
      kind: "empty_highlights",
      title: emptyCopy.title,
      description: emptyCopy.description,
    };
  }

  return { kind: "highlights", findings: highlights };
}

export function formatHistoryFindingsLabel(count: number | null): string | null {
  if (count === null) {
    return null;
  }

  if (count === 1) {
    return "1 finding";
  }

  return `${count} findings`;
}

export function formatHistoryStatusLabel(status: CrawlLifecycleStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "running":
      return "In progress";
    case "queued":
      return "Queued";
    default:
      return status;
  }
}

export function formatSiteScanDate(value: string | null | undefined): string {
  if (!value) {
    return "Unknown date";
  }

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatSiteMetadataLine(input: {
  pagesCrawled: number;
  findingsCount: number;
  completedAt: string;
}): string {
  const pagesLabel = input.pagesCrawled === 1 ? "1 page" : `${input.pagesCrawled} pages`;
  const findingsLabel =
    input.findingsCount === 1 ? "1 finding" : `${input.findingsCount} findings`;

  return `${pagesLabel} · ${findingsLabel} · ${formatSiteScanDate(input.completedAt)}`;
}

export function isHistoryRowClickable(item: ScanHistoryItem): boolean {
  return item.status === "completed" || item.status === "running" || item.status === "queued";
}

export function shouldShowActiveScanBanner(overview: WebsiteOverview): boolean {
  return overview.activeScan !== null;
}

export function shouldShowCurrentState(overview: WebsiteOverview): boolean {
  return overview.latestUsableScan !== null;
}
