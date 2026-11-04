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
