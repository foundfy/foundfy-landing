import type { AnalysisPhase } from "@/contexts/AnalysisContext";

export function buildFullAnalysisHref(crawlRunId: string): string {
  return `/scan/${crawlRunId}`;
}

export function getLandingScanPageLinkLabel(): string {
  return "Open scan page →";
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
