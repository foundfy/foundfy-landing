import type { CrawlComparison, FindingChangeStatus } from "@/lib/analysis/crawl-status";

export function formatComparisonSummary(comparison: CrawlComparison): string {
  const parts = [
    `${comparison.fixed} fixed`,
    `${comparison.stillPresent} still present`,
    `${comparison.new} new`,
  ];

  let summary = parts.join(" · ");

  if (comparison.unverified > 0) {
    summary += ` · ${comparison.unverified} could not be verified`;
  }

  return summary;
}

export function formatChangeStatusLabel(
  changeStatus: FindingChangeStatus,
): string {
  if (changeStatus === "new") {
    return "New since last scan";
  }

  return "Still present";
}
