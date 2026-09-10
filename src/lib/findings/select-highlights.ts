import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import {
  HIGHLIGHT_MAX_COUNT,
  selectHighlightGroups,
  type HighlightGroup,
} from "./highlight-groups";

export { HIGHLIGHT_MAX_COUNT };

export function selectHighlightedFindingIds(
  findings: AnalysisFinding[],
  maxCount = HIGHLIGHT_MAX_COUNT,
): string[] {
  return selectHighlightGroups(findings, maxCount).map(
    (group) => group.representativeFindingId,
  );
}

export { selectHighlightGroups, type HighlightGroup };
