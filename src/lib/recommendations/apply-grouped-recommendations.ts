import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import type { HighlightGroup } from "@/lib/findings/highlight-groups";
import { buildGroupedBrokenLinkRecommendation } from "./build-recommendation";

export function applyGroupedRecommendations(
  findings: AnalysisFinding[],
  highlightGroups: HighlightGroup[],
): AnalysisFinding[] {
  const groupedRecommendationByFindingId = new Map<string, AnalysisFinding["recommendation"]>();

  for (const group of highlightGroups) {
    if (group.affectedPageCount <= 1) {
      continue;
    }

    const representative = findings.find(
      (finding) => finding.id === group.representativeFindingId,
    );

    if (
      !representative ||
      representative.ruleKey !== "internal_structure.broken_internal_link"
    ) {
      continue;
    }

    groupedRecommendationByFindingId.set(
      representative.id,
      buildGroupedBrokenLinkRecommendation(
        {
          ruleKey: representative.ruleKey,
          pageUrl: representative.pageUrl,
          evidence: representative.evidence,
          priorityLevel: representative.priority?.level ?? null,
        },
        group.affectedPageCount,
      ),
    );
  }

  if (groupedRecommendationByFindingId.size === 0) {
    return findings;
  }

  return findings.map((finding) => {
    const groupedRecommendation = groupedRecommendationByFindingId.get(finding.id);
    if (!groupedRecommendation) {
      return finding;
    }

    return {
      ...finding,
      recommendation: groupedRecommendation,
    };
  });
}
