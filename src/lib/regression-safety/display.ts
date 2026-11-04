import type { OriginalIssueStatus, RegressionSafetyReport } from "./types";

export const REGRESSION_SAFETY_HEADING = "Publication check";

export const REGRESSION_SAFETY_OWNER_PUBLISHED_NOTE =
  "The owner published this change. Foundfy compared completed scans and did not publish it.";

function originalIssueCopy(status: OriginalIssueStatus | null): string | null {
  if (status === "resolved") {
    return "The original duplicate meta description issue is no longer present on the compared pages.";
  }
  if (status === "still_present") {
    return "The original duplicate meta description issue is still present.";
  }
  if (status === "not_verified") {
    return "Foundfy could not confirm whether the original issue was resolved.";
  }
  return null;
}

export function formatOperatorRegressionReport(report: RegressionSafetyReport): string {
  const formatted = formatRegressionSafetyReport(report);
  const verdict = report.verdict.toUpperCase().replace("_", " ");
  const matchedUrls = report.urls
    .filter((item) => item.matched)
    .map((item) => item.url);
  const unmatchedUrls = report.urls
    .filter((item) => !item.matched)
    .map((item) => item.url);

  return [
    `${formatted.heading}: ${verdict}`,
    formatted.summary,
    formatted.ownerPublishedNote,
    `Website: ${report.websiteId}`,
    `URLs: ${report.urls.map((item) => item.url).join(", ") || "(none)"}`,
    matchedUrls.length > 0 ? `Matched URLs: ${matchedUrls.join(", ")}` : null,
    unmatchedUrls.length > 0 ? `Unmatched URLs: ${unmatchedUrls.join(", ")}` : null,
    `Baseline crawl: ${report.baselineCrawlId} at ${report.baselineCompletedAt ?? "unknown"}`,
    `Verification crawl: ${report.verificationCrawlId} at ${report.verificationCompletedAt ?? "unknown"}`,
    formatted.originalIssue ? `Original issue: ${formatted.originalIssue}` : null,
    formatted.expected.length > 0
      ? `Expected changes:\n${formatted.expected.map((line) => `- ${line}`).join("\n")}`
      : "Expected changes: none verified",
    formatted.preserved.length > 0
      ? `Preserved metadata:\n${formatted.preserved.map((line) => `- ${line}`).join("\n")}`
      : "Preserved metadata: none fully observed",
    formatted.missing.length > 0
      ? `Confirmed regressions:\n${formatted.missing.map((line) => `- ${line}`).join("\n")}`
      : "Confirmed regressions: none",
    formatted.unverified.length > 0
      ? `Unknown or unverified fields:\n${formatted.unverified.map((line) => `- ${line}`).join("\n")}`
      : "Unknown or unverified fields: none",
    formatted.limitations.length > 0
      ? `Limitations:\n${formatted.limitations.map((line) => `- ${line}`).join("\n")}`
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function formatRegressionSafetyReport(report: RegressionSafetyReport): {
  heading: string;
  summary: string;
  expected: string[];
  preserved: string[];
  missing: string[];
  unverified: string[];
  originalIssue: string | null;
  ownerPublishedNote: string;
  limitations: string[];
} {
  const expected = report.checks
    .filter((check) => check.role === "expected_change" && check.result === "pass")
    .map((check) => `${check.url}: ${check.field} now matches the approved value.`);
  const preserved = report.checks
    .filter((check) => check.role === "preserve" && check.result === "pass")
    .map((check) => `${check.url}: ${check.field} was preserved.`);
  const missing = report.checks
    .filter((check) => check.outcome === "removed" || check.result === "fail")
    .map((check) => `${check.url}: ${check.field} — ${check.note}`);
  const unverified = report.checks
    .filter((check) => check.result === "not_verified")
    .map((check) => `${check.url}: ${check.field} — ${check.note}`);

  return {
    heading: REGRESSION_SAFETY_HEADING,
    summary: report.summary,
    expected,
    preserved,
    missing,
    unverified,
    originalIssue: originalIssueCopy(report.originalIssueStatus),
    ownerPublishedNote: REGRESSION_SAFETY_OWNER_PUBLISHED_NOTE,
    limitations: report.limitations,
  };
}
