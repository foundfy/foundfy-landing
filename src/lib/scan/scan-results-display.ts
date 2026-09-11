import type { CrawlRunViewPhase } from "@/lib/analysis/crawl-status-loader";

export function shouldShowScanResults(input: {
  phase: CrawlRunViewPhase;
  loadedAsCompleted: boolean;
  showResults: boolean;
}): boolean {
  return (
    input.phase === "completed" &&
    (input.loadedAsCompleted || input.showResults)
  );
}
