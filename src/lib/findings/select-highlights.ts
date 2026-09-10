import type { AnalysisFinding, PriorityLevel } from "@/lib/analysis/crawl-status";

const HIGHLIGHT_LEVELS = new Set<PriorityLevel>(["critical", "high", "medium"]);

export const HIGHLIGHT_MAX_COUNT = 3;

export function selectHighlightedFindingIds(
  findings: AnalysisFinding[],
  maxCount = HIGHLIGHT_MAX_COUNT,
): string[] {
  return findings
    .filter(
      (finding) =>
        finding.priority !== null &&
        HIGHLIGHT_LEVELS.has(finding.priority.level),
    )
    .slice(0, maxCount)
    .map((finding) => finding.id);
}
