import { hasMeaningfulVisibility } from "@/lib/decisions/score";
import { isClearlyBrandedQuery, opportunityCompactKey } from "./normalize";
import type {
  OpportunityMemberPageEvidence,
  OpportunityQueryInput,
  OpportunityQueryPageInput,
  OpportunityVariantEvidence,
  QueryOpportunityCard,
} from "./types";

function opportunityId(groupingKey: string, leadingPageUrl: string): string {
  return `${groupingKey}\t${leadingPageUrl}`;
}

function compareQueries(left: OpportunityQueryInput, right: OpportunityQueryInput): number {
  if (right.impressions !== left.impressions) {
    return right.impressions - left.impressions;
  }
  if (right.clicks !== left.clicks) {
    return right.clicks - left.clicks;
  }
  return left.query.localeCompare(right.query);
}

function leadingPage(
  rows: OpportunityQueryPageInput[],
): { pageUrl: string; pageId: string | null } | null {
  const byUrl = new Map<string, { impressions: number; pageId: string | null }>();

  for (const row of rows) {
    const current = byUrl.get(row.pageUrl);
    if (!current) {
      byUrl.set(row.pageUrl, { impressions: row.impressions, pageId: row.pageId });
      continue;
    }

    current.impressions += row.impressions;
    if (!current.pageId && row.pageId) {
      current.pageId = row.pageId;
    }
  }

  const ranked = [...byUrl.entries()].sort((left, right) => {
    if (right[1].impressions !== left[1].impressions) {
      return right[1].impressions - left[1].impressions;
    }
    return left[0].localeCompare(right[0]);
  });

  const winner = ranked[0];
  if (!winner) {
    return null;
  }

  return { pageUrl: winner[0], pageId: winner[1].pageId };
}

export function impressionWeightedPosition(
  members: Pick<OpportunityQueryInput, "impressions" | "position">[],
): number | null {
  const totalImpressions = members.reduce((sum, row) => sum + row.impressions, 0);
  if (totalImpressions <= 0) {
    return null;
  }

  const weighted = members.reduce((sum, row) => sum + row.position * row.impressions, 0);
  return weighted / totalImpressions;
}

function pagesForQuery(
  query: string,
  queryPages: OpportunityQueryPageInput[],
): OpportunityQueryPageInput[] {
  return queryPages.filter((row) => row.query === query && row.pageUrl.trim());
}

export function deriveQueryOpportunities(input: {
  hostname: string;
  queries: OpportunityQueryInput[];
  queryPages: OpportunityQueryPageInput[];
}): QueryOpportunityCard[] {
  const maxImpressions = input.queries.reduce(
    (max, row) => Math.max(max, row.impressions),
    0,
  );

  type EligibleMember = OpportunityQueryInput & {
    compactKey: string;
    page: { pageUrl: string; pageId: string | null };
    memberPages: OpportunityQueryPageInput[];
  };

  const eligible: EligibleMember[] = [];
  for (const row of input.queries) {
    if (!row.query.trim()) {
      continue;
    }
    if (!hasMeaningfulVisibility(row, maxImpressions)) {
      continue;
    }
    if (isClearlyBrandedQuery(row.query, input.hostname)) {
      continue;
    }

    const compactKey = opportunityCompactKey(row.query);
    if (!compactKey) {
      continue;
    }

    const memberPages = pagesForQuery(row.query, input.queryPages);
    const page = leadingPage(memberPages);
    if (!page) {
      continue;
    }

    eligible.push({ ...row, compactKey, page, memberPages });
  }

  const groups = new Map<string, EligibleMember[]>();
  for (const member of eligible) {
    const id = opportunityId(member.compactKey, member.page.pageUrl);
    const members = groups.get(id) ?? [];
    members.push(member);
    groups.set(id, members);
  }

  const cards: QueryOpportunityCard[] = [];
  for (const members of groups.values()) {
    const sorted = [...members].sort(compareQueries);
    const display = sorted[0];
    if (!display) {
      continue;
    }

    const appearances = sorted.reduce((sum, row) => sum + row.impressions, 0);
    const visits = sorted.reduce((sum, row) => sum + row.clicks, 0);
    const pageId =
      sorted.find((row) => row.page.pageId)?.page.pageId ?? display.page.pageId;
    const variantEvidence: OpportunityVariantEvidence[] = sorted.map((row) => ({
      query: row.query,
      appearances: row.impressions,
      visits: row.clicks,
      position: row.position,
    }));
    const memberPages: OpportunityMemberPageEvidence[] = sorted.flatMap((row) =>
      [...row.memberPages]
        .sort((left, right) => {
          if (right.impressions !== left.impressions) {
            return right.impressions - left.impressions;
          }
          return left.pageUrl.localeCompare(right.pageUrl);
        })
        .map((page) => ({
          query: page.query,
          pageUrl: page.pageUrl,
          impressions: page.impressions,
        })),
    );

    cards.push({
      id: opportunityId(display.compactKey, display.page.pageUrl),
      query: display.query,
      groupingKey: display.compactKey,
      appearances,
      visits,
      position: impressionWeightedPosition(sorted),
      leadingPageUrl: display.page.pageUrl,
      leadingPageId: pageId,
      mapped: Boolean(pageId),
      variants: variantEvidence.map((row) => row.query),
      variantEvidence,
      memberPages,
    });
  }

  return cards.sort((left, right) => {
    if (right.appearances !== left.appearances) {
      return right.appearances - left.appearances;
    }
    if (right.visits !== left.visits) {
      return right.visits - left.visits;
    }
    return left.query.localeCompare(right.query);
  });
}
