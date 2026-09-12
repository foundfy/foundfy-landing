import type { CrawlComparison, FindingChangeStatus } from "@/lib/analysis/crawl-status";
import { formatJobCount } from "./finding-display";

function formatFindingNoun(count: number): string {
  return count === 1 ? "finding" : "findings";
}

function formatJobsSuffix(jobCount?: number | null): string {
  if (typeof jobCount !== "number" || jobCount <= 0) {
    return "";
  }

  return ` across ${formatJobCount(jobCount)}`;
}

export function formatComparisonSummary(
  comparison: CrawlComparison,
  jobCount?: number | null,
): string {
  const parts = [
    `${comparison.fixed} ${formatFindingNoun(comparison.fixed)} fixed`,
    `${comparison.stillPresent} ${formatFindingNoun(comparison.stillPresent)} still present`,
    `${comparison.new} new`,
  ];

  let summary = parts.join(" · ");

  if (comparison.unverified > 0) {
    summary += ` · ${comparison.unverified} could not be verified`;
  }

  summary += formatJobsSuffix(jobCount);

  return summary;
}

export function formatComparisonNarrative(
  comparison: CrawlComparison,
  jobCount?: number | null,
): string {
  const sentences: string[] = [];
  const jobsSuffix = formatJobsSuffix(jobCount);

  if (comparison.fixed > 0) {
    sentences.push(
      `${comparison.fixed} ${formatFindingNoun(comparison.fixed)} fixed`,
    );
  }

  if (comparison.new > 0) {
    const noun = comparison.new === 1 ? "finding" : "findings";
    sentences.push(`${comparison.new} new ${noun} appeared`);
  }

  if (comparison.stillPresent > 0) {
    const verb = comparison.stillPresent === 1 ? "is" : "are";
    sentences.push(
      `${comparison.stillPresent} ${formatFindingNoun(comparison.stillPresent)} ${verb} still present${jobsSuffix}`,
    );
  } else if (jobsSuffix && comparison.fixed === 0 && comparison.new === 0) {
    sentences.push(`No raw findings changed${jobsSuffix}`);
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
