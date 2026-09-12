import type {
  AnalysisFinding,
  HighlightGroupSummary,
  PriorityLevel,
} from "@/lib/analysis/crawl-status";
import {
  normalizeCrawlUrl,
  normalizeSiteHostname,
} from "@/lib/crawler/url/normalize";
import type { RuleKey } from "@/lib/observations/types";
import { collectNormalizedAffectedSourceUrls } from "./highlight-aggregation";
import { sortFindings } from "./order";

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

function normalizeEvidenceText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

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

function buildDuplicateTitleGroupKey(finding: AnalysisFinding): string | null {
  const title = normalizeEvidenceText(finding.evidence.title);
  return title ? `page_fundamentals.duplicate_title:${title}` : null;
}

function buildDuplicateMetaGroupKey(finding: AnalysisFinding): string | null {
  const description = normalizeEvidenceText(finding.evidence.metaDescription);
  return description
    ? `page_fundamentals.duplicate_meta_description:${description}`
    : null;
}

export function normalizeHumanActionUrl(rawUrl: string): string | null {
  const normalized = normalizeCrawlUrl(rawUrl);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    parsed.protocol = "https:";
    parsed.hostname = normalizeSiteHostname(parsed.hostname);
    return parsed.toString();
  } catch {
    return normalized;
  }
}

function buildCanonicalElsewhereGroupKey(finding: AnalysisFinding): string | null {
  const canonical = finding.evidence.canonical;
  if (typeof canonical !== "string" || canonical.length === 0) {
    return null;
  }

  const normalized = normalizeHumanActionUrl(canonical);
  return normalized
    ? `indexability.canonical_points_elsewhere:${normalized}`
    : null;
}

export type ActionGroupContext = {
  duplicateTitles: Set<string>;
};

export function buildActionGroupContext(
  findings: AnalysisFinding[],
): ActionGroupContext {
  const duplicateTitles = new Set<string>();

  for (const finding of findings) {
    if (finding.ruleKey !== "page_fundamentals.duplicate_title") {
      continue;
    }

    const title = normalizeEvidenceText(finding.evidence.title);
    if (title) {
      duplicateTitles.add(title);
    }
  }

  return { duplicateTitles };
}

const GROUP_KEY_BUILDERS: Partial<Record<RuleKey, GroupKeyBuilder>> = {
  "internal_structure.broken_internal_link": buildBrokenLinkGroupKey,
  "page_fundamentals.duplicate_title": buildDuplicateTitleGroupKey,
  "page_fundamentals.duplicate_meta_description": buildDuplicateMetaGroupKey,
  "indexability.canonical_points_elsewhere": buildCanonicalElsewhereGroupKey,
};

export function getActionGroupKey(
  finding: AnalysisFinding,
  context?: ActionGroupContext,
): string {
  if (finding.ruleKey === "page_fundamentals.title_length_out_of_range") {
    const title = normalizeEvidenceText(finding.evidence.title);
    if (title && context?.duplicateTitles.has(title)) {
      return `page_fundamentals.duplicate_title:${title}`;
    }
  }

  const builder = GROUP_KEY_BUILDERS[finding.ruleKey as RuleKey];
  const evidenceKey = builder?.(finding);
  return evidenceKey ?? finding.ruleKey;
}

export function getHighlightGroupKey(finding: AnalysisFinding): string | null {
  return getActionGroupKey(finding);
}

function isHighlightLevel(finding: AnalysisFinding): boolean {
  return (
    finding.priority !== null && HIGHLIGHT_LEVELS.has(finding.priority.level)
  );
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
  const uniquePageUrls = collectNormalizedAffectedSourceUrls(members);

  return {
    ...group,
    rawFindingCount,
    affectedPageCount: uniquePageUrls.length > 0 ? uniquePageUrls.length : 1,
  };
}

export function groupFindingsByAction(
  findings: AnalysisFinding[],
  options?: { highlightLevelsOnly?: boolean },
): HighlightGroup[] {
  const ordered = sortFindings(findings);
  const findingsById = new Map(ordered.map((finding) => [finding.id, finding]));
  const context = buildActionGroupContext(ordered);
  const groups: Array<
    Omit<HighlightGroup, "rawFindingCount" | "affectedPageCount"> & {
      memberFindingIds: string[];
    }
  > = [];
  const groupIndexByKey = new Map<string, number>();

  for (const finding of ordered) {
    const groupKey = getActionGroupKey(finding, context);
    const existingIndex = groupIndexByKey.get(groupKey);

    if (existingIndex !== undefined) {
      groups[existingIndex]?.memberFindingIds.push(finding.id);
      continue;
    }

    groupIndexByKey.set(groupKey, groups.length);
    groups.push({
      groupKey,
      representativeFindingId: finding.id,
      memberFindingIds: [finding.id],
    });
  }

  const finalized = groups.map((group) =>
    finalizeHighlightGroupMetrics(group, findingsById),
  );

  if (!options?.highlightLevelsOnly) {
    return finalized;
  }

  return finalized.filter((group) =>
    group.memberFindingIds.some((findingId) => {
      const finding = findingsById.get(findingId);
      return finding ? isHighlightLevel(finding) : false;
    }),
  );
}

export function selectHighlightGroups(
  findings: AnalysisFinding[],
  maxCount = HIGHLIGHT_MAX_COUNT,
): HighlightGroup[] {
  return groupFindingsByAction(findings, { highlightLevelsOnly: true }).slice(
    0,
    maxCount,
  );
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

export function collectAffectedDisplayUrls(
  findingsById: Map<string, AnalysisFinding>,
  memberFindingIds: string[],
): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const findingId of memberFindingIds) {
    const finding = findingsById.get(findingId);
    const pageUrl = finding?.pageUrl;
    if (!pageUrl) {
      continue;
    }

    const normalized = normalizeCrawlUrl(pageUrl) ?? pageUrl;
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    urls.push(pageUrl);
  }

  return urls;
}
