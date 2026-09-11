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

export function formatComparisonNarrative(comparison: CrawlComparison): string {
  const sentences: string[] = [];

  if (comparison.fixed > 0) {
    const noun = comparison.fixed === 1 ? "issue" : "issues";
    sentences.push(`${comparison.fixed} ${noun} fixed`);
  }

  if (comparison.new > 0) {
    const noun = comparison.new === 1 ? "issue" : "issues";
    sentences.push(`${comparison.new} new ${noun} appeared`);
  }

  if (comparison.stillPresent > 0) {
    const verb = comparison.stillPresent === 1 ? "is" : "are";
    sentences.push(`${comparison.stillPresent} ${verb} still present`);
  }

  if (comparison.unverified > 0) {
    sentences.push(`${comparison.unverified} could not be verified`);
  }

  if (sentences.length === 0) {
    return "No changes since your last scan.";
  }

  return `${sentences.join(". ")}.`;
}

export function formatFirstScanProgressCopy(): string {
  return "This is your first scan. Future scans will show what changed.";
}

export function formatChangeStatusLabel(
  changeStatus: FindingChangeStatus,
): string {
  if (changeStatus === "new") {
    return "New since last scan";
  }

  return "Still present";
}
