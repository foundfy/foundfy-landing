import type { AnalysisPhase } from "@/contexts/AnalysisContext";

export type ResultsCtaSurface = "landing" | "scan";

export function buildFullAnalysisHref(crawlRunId: string): string {
  return `/scan/${crawlRunId}`;
}

export function getLandingScanPageLinkLabel(): string {
  return "Open scan page →";
}

export function getScanAgainLabel(): string {
  return "Made changes? Scan again to verify →";
}

export function getSiteRescanLabel(): string {
  return "Run new scan";
}

export function shouldShowScanAgain(input: {
  surface: ResultsCtaSurface;
  websiteId: string | null | undefined;
}): boolean {
  return (
    input.surface === "scan" &&
    typeof input.websiteId === "string" &&
    input.websiteId.length > 0
  );
}

export function getSiteScanLinkLabel(): string {
  return "View this scan →";
}

export function getScanResultsResetLabel(hasSiteOverview: boolean): string {
  return hasSiteOverview ? "View site overview" : "Back to home";
}

export function shouldShowLandingFullAnalysisLink(input: {
  phase: AnalysisPhase;
  crawlRunId: string | null;
}): boolean {
  return input.phase === "completed" && input.crawlRunId !== null;
}
