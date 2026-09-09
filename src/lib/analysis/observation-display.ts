import type { RedirectHop } from "@/lib/crawler/types";
import type { AnalysisObservation } from "./crawl-status";

function isRedirectHop(value: unknown): value is RedirectHop {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    "statusCode" in value
  );
}

export function formatObservationEvidence(
  observation: AnalysisObservation,
): string | null {
  const { evidence, ruleKey } = observation;

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

export function formatSeverityLabel(
  severity: AnalysisObservation["severity"],
): string {
  switch (severity) {
    case "warning":
      return "Notice";
    case "error":
      return "Issue";
    default:
      return "Info";
  }
}

export function formatObservationCount(count: number): string {
  if (count === 1) {
    return "We found 1 thing worth noting.";
  }

  return `We found ${count} things worth noting.`;
}
