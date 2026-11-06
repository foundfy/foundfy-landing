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

export const RESULTS_HELP_CTA_COPY = {
  heading: "Want help fixing what matters first?",
  body: "We're working hands-on with a few small businesses. We'll agree on the top fix with you, help you get it live, then scan again to confirm the change is in place.",
  linkLabel: "Get help with this →",
  href: "#early-access",
} as const;

export function shouldShowResultsHelpCta(input: {
  surface: ResultsCtaSurface;
  findingsCount: number;
}): boolean {
  return input.surface === "landing" && input.findingsCount > 0;
}

export function shouldShowLandingFullAnalysisLink(input: {
  phase: AnalysisPhase;
  crawlRunId: string | null;
}): boolean {
  return input.phase === "completed" && input.crawlRunId !== null;
}
