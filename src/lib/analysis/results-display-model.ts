import type {
  AnalysisFinding,
  FindingsSummary,
} from "@/lib/analysis/crawl-status";
import {
  collectAffectedDisplayUrls,
  groupFindingsByAction,
  type HighlightGroup,
} from "@/lib/findings/highlight-groups";
import {
  formatGroupedFindingTitle,
  formatResultsBrief,
  formatSeriousnessLine,
  shouldCollapseAllFindings,
  type ResultsBriefGroup,
} from "./finding-display";

export type GroupedFindingCard = {
  key: string;
  finding: AnalysisFinding;
  title: string;
  affectedPageCount: number;
  affectedUrls: string[];
  rawFindingCount: number;
};

export type ResultsDisplayModel = {
  brief: string;
  seriousness: string | null;
  highlightCards: GroupedFindingCard[];
  allFindingCards: GroupedFindingCard[];
  collapseAllFindings: boolean;
  actionGroupCount: number;
};

function toBriefGroup(
  group: HighlightGroup,
  finding: AnalysisFinding | undefined,
): ResultsBriefGroup | null {
  if (!finding) {
    return null;
  }

  return {
    ruleKey: finding.ruleKey,
    title: finding.title,
    affectedPageCount: group.affectedPageCount,
    priorityLevel: finding.priority?.level ?? null,
  };
}

function toGroupedCard(
  group: HighlightGroup,
  findingsById: Map<string, AnalysisFinding>,
): GroupedFindingCard | null {
  const finding = findingsById.get(group.representativeFindingId);
  if (!finding) {
    return null;
  }

  const affectedUrls = collectAffectedDisplayUrls(
    findingsById,
    group.memberFindingIds,
  );

  return {
    key: group.groupKey,
    finding: {
      ...finding,
      highlightAggregation:
        group.affectedPageCount > 1
          ? { affectedPageCount: group.affectedPageCount }
          : finding.highlightAggregation,
    },
    title: formatGroupedFindingTitle(
      finding.ruleKey,
      finding.title,
      group.affectedPageCount,
    ),
    affectedPageCount: group.affectedPageCount,
    affectedUrls,
    rawFindingCount: group.rawFindingCount,
  };
}

export function buildResultsDisplayModel(
  findings: AnalysisFinding[],
  findingsSummary: FindingsSummary,
): ResultsDisplayModel {
  const findingsById = new Map(findings.map((finding) => [finding.id, finding]));
  const actionGroups = groupFindingsByAction(findings);
  const highlightGroups = findingsSummary.highlightGroups.map((summary) => ({
    groupKey: summary.representativeFindingId,
    representativeFindingId: summary.representativeFindingId,
    memberFindingIds: summary.memberFindingIds,
    rawFindingCount: summary.rawFindingCount,
    affectedPageCount: summary.affectedPageCount,
  }));

  const briefGroups = actionGroups
    .map((group) =>
      toBriefGroup(group, findingsById.get(group.representativeFindingId)),
    )
    .filter((group): group is ResultsBriefGroup => group !== null);

  const highlightCards = highlightGroups
    .map((group) => toGroupedCard(group, findingsById))
    .filter((card): card is GroupedFindingCard => card !== null);

  const allFindingCards = actionGroups
    .map((group) => toGroupedCard(group, findingsById))
    .filter((card): card is GroupedFindingCard => card !== null);

  return {
    brief: formatResultsBrief(briefGroups),
    seriousness: formatSeriousnessLine(briefGroups),
    highlightCards,
    allFindingCards,
    collapseAllFindings: shouldCollapseAllFindings(allFindingCards.length),
    actionGroupCount: allFindingCards.length,
  };
}

