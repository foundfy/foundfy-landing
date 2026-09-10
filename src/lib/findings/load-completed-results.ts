import { attachExplanationEnrichments } from "@/lib/ai-enrichment/attach-enrichments";
import { isAiEnrichmentEnabled } from "@/lib/ai-enrichment/config";
import { loadFindingsForCompletedRun } from "./load-for-run";

export async function loadCompletedCrawlResults(crawlRunId: string) {
  const base = await loadFindingsForCompletedRun(crawlRunId);

  if (!isAiEnrichmentEnabled()) {
    return {
      ...base,
      explanationEnrichmentStatus: "disabled" as const,
    };
  }

  const enriched = await attachExplanationEnrichments({
    crawlRunId,
    findings: base.findings,
    highlightedFindingIds: base.findingsSummary.highlightedFindingIds,
  });

  return {
    findings: enriched.findings,
    findingsSummary: base.findingsSummary,
    explanationEnrichmentStatus: enriched.explanationEnrichmentStatus,
  };
}
