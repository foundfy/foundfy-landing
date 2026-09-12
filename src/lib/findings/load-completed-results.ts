import { attachExplanationEnrichments } from "@/lib/ai-enrichment/attach-enrichments";
import { isAiEnrichmentEnabled } from "@/lib/ai-enrichment/config";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import { deriveSearchPresenceSignals } from "@/lib/analysis/search-presence";
import { loadCrawlEvidenceContext } from "@/lib/observations/db/repository";
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

async function loadSearchPresenceSignals(
  crawlRunId: string,
  findings: AnalysisFinding[],
) {
  try {
    const context = await loadCrawlEvidenceContext(crawlRunId);
    return deriveSearchPresenceSignals(context, findings);
  } catch {
    return deriveSearchPresenceSignals(null, findings);
  }
}

export async function loadCompletedCrawlResults(crawlRunId: string) {
  const base = await loadFindingsForCompletedRun(crawlRunId);
  const comparisonResult = await compareWithPreviousCrawl(crawlRunId);
  const searchPresence = await loadSearchPresenceSignals(crawlRunId, base.findings);

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
      searchPresence,
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
    searchPresence,
    explanationEnrichmentStatus: enriched.explanationEnrichmentStatus,
  };
}
