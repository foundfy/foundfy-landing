import type {
  AnalysisFinding,
  HighlightGroupSummary,
  PriorityLevel,
} from "@/lib/analysis/crawl-status";
import { normalizeCrawlUrl } from "@/lib/crawler/url/normalize";
import type { RuleKey } from "@/lib/observations/types";
import { computeBrokenLinkAffectedPageCount } from "./highlight-aggregation";

export const HIGHLIGHT_MAX_COUNT = 3;

const HIGHLIGHT_LEVELS = new Set<PriorityLevel>(["critical", "high", "medium"]);

export type HighlightGroup = {
  groupKey: string;
  representativeFindingId: string;
  memberFindingIds: string[];
  rawFindingCount: number;
  affectedPageCount: number;
};

type GroupKeyBuilder = (finding: AnalysisFinding) => string | null;

function buildBrokenLinkGroupKey(finding: AnalysisFinding): string | null {
  const linkToUrl = finding.evidence.linkToUrl;
  if (typeof linkToUrl !== "string" || linkToUrl.length === 0) {
    return null;
  }

  const normalizedTarget = normalizeCrawlUrl(linkToUrl);
  if (!normalizedTarget) {
    return null;
  }

  return `internal_structure.broken_internal_link:${normalizedTarget}`;
}

const GROUP_KEY_BUILDERS: Partial<Record<RuleKey, GroupKeyBuilder>> = {
  "internal_structure.broken_internal_link": buildBrokenLinkGroupKey,
};

export function getHighlightGroupKey(finding: AnalysisFinding): string | null {
  const builder = GROUP_KEY_BUILDERS[finding.ruleKey as RuleKey];
  if (!builder) {
    return null;
  }

  return builder(finding);
}

function resolveGroupKey(finding: AnalysisFinding): string {
  return getHighlightGroupKey(finding) ?? finding.id;
}

function finalizeHighlightGroupMetrics(
  group: Omit<HighlightGroup, "rawFindingCount" | "affectedPageCount"> & {
    memberFindingIds: string[];
  },
  findingsById: Map<string, AnalysisFinding>,
): HighlightGroup {
  const members = group.memberFindingIds
    .map((findingId) => findingsById.get(findingId))
    .filter((finding): finding is AnalysisFinding => finding !== undefined);
  const rawFindingCount = members.length;

  if (members[0]?.ruleKey === "internal_structure.broken_internal_link") {
    return {
      ...group,
      rawFindingCount,
      affectedPageCount: computeBrokenLinkAffectedPageCount(members),
    };
  }

  return {
    ...group,
    rawFindingCount,
    affectedPageCount: 1,
  };
}

export function selectHighlightGroups(
  findings: AnalysisFinding[],
  maxCount = HIGHLIGHT_MAX_COUNT,
): HighlightGroup[] {
  const findingsById = new Map(findings.map((finding) => [finding.id, finding]));
  const groups: Array<
    Omit<HighlightGroup, "rawFindingCount" | "affectedPageCount"> & {
      memberFindingIds: string[];
    }
  > = [];
  const groupIndexByKey = new Map<string, number>();

  for (const finding of findings) {
    if (
      finding.priority === null ||
      !HIGHLIGHT_LEVELS.has(finding.priority.level)
    ) {
      continue;
    }

    const groupKey = resolveGroupKey(finding);
    const existingIndex = groupIndexByKey.get(groupKey);

    if (existingIndex !== undefined) {
      groups[existingIndex]?.memberFindingIds.push(finding.id);
      continue;
    }

    if (groups.length >= maxCount) {
      continue;
    }

    groupIndexByKey.set(groupKey, groups.length);
    groups.push({
      groupKey,
      representativeFindingId: finding.id,
      memberFindingIds: [finding.id],
    });
  }

  return groups.map((group) => finalizeHighlightGroupMetrics(group, findingsById));
}

export function toHighlightGroupSummaries(
  groups: HighlightGroup[],
): HighlightGroupSummary[] {
  return groups.map((group) => ({
    representativeFindingId: group.representativeFindingId,
    memberFindingIds: group.memberFindingIds,
    rawFindingCount: group.rawFindingCount,
    affectedPageCount: group.affectedPageCount,
  }));
}

export function getHighlightGroupForFinding(
  findingId: string,
  groups: HighlightGroupSummary[],
): HighlightGroupSummary | undefined {
  return groups.find(
    (group) =>
      group.representativeFindingId === findingId ||
      group.memberFindingIds.includes(findingId),
  );
}
