import type {
  AnalysisFinding,
  FindingChangeStatus,
  FindingsSummary,
} from "@/lib/analysis/crawl-status";
import {
  collectAffectedDisplayUrls,
  groupFindingsByAction,
  selectHighlightGroups,
  type HighlightGroup,
} from "@/lib/findings/highlight-groups";
import {
  formatAffectedPageLabel,
  formatGroupedFindingTitle,
  formatResultsBrief,
  formatSeriousnessLine,
  formatSharedTitleLine,
  readSharedTitle,
  shouldCollapseAllFindings,
  shouldShowHostInAffectedPages,
  type ResultsBriefGroup,
} from "./finding-display";

export type AffectedPageDetail = {
  url: string;
  label: string;
  canonicalLabel: string | null;
};

export type GroupedFindingCard = {
  key: string;
  finding: AnalysisFinding;
  title: string;
  sharedTitleLine: string | null;
  affectedPageCount: number;
  affectedUrls: string[];
  affectedPages: AffectedPageDetail[];
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

function readCanonicalLabel(finding: AnalysisFinding): string | null {
  const canonical = finding.evidence.canonical;
  if (typeof canonical !== "string" || canonical.length === 0) {
    return null;
  }

  return formatAffectedPageLabel(canonical);
}

function resolveGroupChangeStatus(
  members: AnalysisFinding[],
): FindingChangeStatus | undefined {
  if (members.some((finding) => finding.changeStatus === "still_present")) {
    return "still_present";
  }

  if (members.some((finding) => finding.changeStatus === "new")) {
    return "new";
  }

  return undefined;
}

function toGroupedCard(
  group: HighlightGroup,
  findingsById: Map<string, AnalysisFinding>,
): GroupedFindingCard | null {
  const finding = findingsById.get(group.representativeFindingId);
  if (!finding) {
    return null;
  }

  const members = group.memberFindingIds
    .map((findingId) => findingsById.get(findingId))
    .filter((member): member is AnalysisFinding => member !== undefined);
  const affectedUrls = collectAffectedDisplayUrls(
    findingsById,
    group.memberFindingIds,
  );
  const includeHost = shouldShowHostInAffectedPages(affectedUrls);
  const showCanonical =
    finding.ruleKey === "indexability.canonical_points_elsewhere";
  const affectedPages = affectedUrls.map((url) => {
    const pageFinding = members.find((member) => member.pageUrl === url);
    return {
      url,
      label: formatAffectedPageLabel(url, { includeHost }),
      canonicalLabel: showCanonical
        ? (pageFinding ? readCanonicalLabel(pageFinding) : null)
        : null,
    };
  });
  const sharedTitle = readSharedTitle(finding.evidence);
  const changeStatus = resolveGroupChangeStatus(members);

  return {
    key: group.groupKey,
    finding: {
      ...finding,
      changeStatus: changeStatus ?? finding.changeStatus,
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
    sharedTitleLine:
      finding.ruleKey === "page_fundamentals.duplicate_title"
        ? formatSharedTitleLine(sharedTitle, group.affectedPageCount)
        : null,
    affectedPageCount: group.affectedPageCount,
    affectedUrls,
    affectedPages,
    rawFindingCount: group.rawFindingCount,
  };
}

export function buildResultsDisplayModel(
  findings: AnalysisFinding[],
  _findingsSummary: FindingsSummary,
): ResultsDisplayModel {
  const findingsById = new Map(findings.map((finding) => [finding.id, finding]));
  const actionGroups = groupFindingsByAction(findings);
  const highlightGroups = selectHighlightGroups(findings);

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
