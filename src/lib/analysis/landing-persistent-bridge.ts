import type { AnalysisPhase } from "@/contexts/AnalysisContext";

export function buildFullAnalysisHref(crawlRunId: string): string {
  return `/scan/${crawlRunId}`;
}

export function shouldShowLandingFullAnalysisLink(input: {
  phase: AnalysisPhase;
  crawlRunId: string | null;
}): boolean {
  return input.phase === "completed" && input.crawlRunId !== null;
}
