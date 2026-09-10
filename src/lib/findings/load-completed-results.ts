import { attachExplanationEnrichments } from "@/lib/ai-enrichment/attach-enrichments";
import { isAiEnrichmentEnabled } from "@/lib/ai-enrichment/config";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import { compareWithPreviousCrawl } from "./comparison/compare-crawls";
import { loadFindingsForCompletedRun } from "./load-for-run";

function attachChangeStatuses(
  findings: AnalysisFinding[],
  changeStatusByObservationId: Map<string, AnalysisFinding["changeStatus"]>,
): AnalysisFinding[] {
  return findings.map((finding) => {
    const changeStatus = changeStatusByObservationId.get(finding.id);
    return changeStatus ? { ...finding, changeStatus } : finding;
  });
}

export async function loadCompletedCrawlResults(crawlRunId: string) {
  const base = await loadFindingsForCompletedRun(crawlRunId);
  const comparisonResult = await compareWithPreviousCrawl(crawlRunId);

  const findingsWithComparison = comparisonResult
    ? attachChangeStatuses(
        base.findings,
        comparisonResult.changeStatusByObservationId,
      )
    : base.findings;

  const comparison = comparisonResult?.comparison;

  if (!isAiEnrichmentEnabled()) {
    return {
      findings: findingsWithComparison,
      findingsSummary: base.findingsSummary,
      comparison,
      explanationEnrichmentStatus: "disabled" as const,
    };
  }

  const enriched = await attachExplanationEnrichments({
    crawlRunId,
    findings: findingsWithComparison,
    highlightedFindingIds: base.findingsSummary.highlightedFindingIds,
  });

  return {
    findings: enriched.findings,
    findingsSummary: base.findingsSummary,
    comparison,
    explanationEnrichmentStatus: enriched.explanationEnrichmentStatus,
  };
}
