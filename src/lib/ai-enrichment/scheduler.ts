import type { AnalysisFinding, FindingsSummary } from "@/lib/analysis/crawl-status";
import { isAiEnrichmentEnabled } from "./config";
import {
  generateExplanationEnrichments,
  shouldAutoGenerateExplanationEnrichment,
} from "./explanation/generate";

export async function scheduleExplanationEnrichmentIfNeeded(input: {
  crawlRunId: string;
  hostname: string;
  pagesCrawled: number;
  findings: AnalysisFinding[];
  findingsSummary: FindingsSummary;
}): Promise<void> {
  if (!isAiEnrichmentEnabled()) {
    return;
  }

  if (input.pagesCrawled <= 0) {
    return;
  }

  if (
    !shouldAutoGenerateExplanationEnrichment({
      highlightedFindingIds: input.findingsSummary.highlightedFindingIds,
    })
  ) {
    return;
  }

  await generateExplanationEnrichments({
    crawlRunId: input.crawlRunId,
    hostname: input.hostname,
    pagesCrawled: input.pagesCrawled,
    findings: input.findings,
    findingIds: input.findingsSummary.highlightedFindingIds,
    highlightGroups: input.findingsSummary.highlightGroups,
  });
}
