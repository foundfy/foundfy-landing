import type { RedirectHop } from "@/lib/crawler/types";
import type { AnalysisFinding, PriorityLevel } from "./crawl-status";

function isRedirectHop(value: unknown): value is RedirectHop {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    "statusCode" in value
  );
}

export function formatFindingEvidence(finding: AnalysisFinding): string | null {
  const { evidence, ruleKey } = finding;

  if (ruleKey === "indexability.redirecting_url") {
    const redirectChain = Array.isArray(evidence.redirectChain)
      ? evidence.redirectChain.filter(isRedirectHop)
      : [];
    const finalUrl =
      typeof evidence.finalUrl === "string" ? evidence.finalUrl : null;

    if (redirectChain.length > 0 && finalUrl) {
      const hop = redirectChain[0];
      return `${hop.statusCode} redirect → ${finalUrl}`;
    }

    if (
      typeof evidence.requestedUrl === "string" &&
      typeof evidence.finalUrl === "string"
    ) {
      return `${evidence.requestedUrl} → ${evidence.finalUrl}`;
    }
  }

  const entries = Object.entries(evidence).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  if (entries.length === 0) {
    return null;
  }

  return entries
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

export function formatPriorityLabel(level: PriorityLevel): string {
  switch (level) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    default:
      return "Low";
  }
}

export function formatFindingPath(pageUrl: string | null): string | null {
  if (!pageUrl) {
    return null;
  }

  try {
    const url = new URL(pageUrl);
    return url.pathname || "/";
  } catch {
    return pageUrl;
  }
}

export function formatFindingsCount(count: number): string {
  if (count === 1) {
    return "We found 1 finding.";
  }

  return `We found ${count} findings.`;
}

export function formatZeroFindingsCopy(): {
  title: string;
  description: string;
} {
  return {
    title: "No notable issues found.",
    description: "We didn't find any of the issues Foundfy currently checks for.",
  };
}

export function formatEmptyHighlightsCopy(): {
  title: string;
  description: string;
} {
  return {
    title: "Nothing stands out as a priority.",
    description: "You can still review the findings below.",
  };
}
