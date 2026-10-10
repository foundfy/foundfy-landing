import { hasMeaningfulVisibility } from "@/lib/decisions/score";
import { isClearlyBrandedQuery, opportunityQueryKey } from "./normalize";
import type {
  OpportunityQueryInput,
  OpportunityQueryPageInput,
  QueryOpportunityCard,
} from "./types";

function opportunityId(groupingKey: string, leadingPageUrl: string): string {
  return `${groupingKey}\t${leadingPageUrl}`;
}

function pickDisplayQuery(variants: OpportunityQueryInput[]): OpportunityQueryInput {
  return [...variants].sort((left, right) => {
    if (right.impressions !== left.impressions) {
      return right.impressions - left.impressions;
    }
    if (right.clicks !== left.clicks) {
      return right.clicks - left.clicks;
    }
    return left.query.localeCompare(right.query);
  })[0];
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

export function deriveQueryOpportunities(input: {
  hostname: string;
  queries: OpportunityQueryInput[];
  queryPages: OpportunityQueryPageInput[];
}): QueryOpportunityCard[] {
  const maxImpressions = input.queries.reduce(
    (max, row) => Math.max(max, row.impressions),
    0,
  );

  const groups = new Map<string, OpportunityQueryInput[]>();
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

    const groupingKey = opportunityQueryKey(row.query);
    if (!groupingKey) {
      continue;
    }

    const members = groups.get(groupingKey) ?? [];
    members.push(row);
    groups.set(groupingKey, members);
  }

  const queryPagesByKey = new Map<string, OpportunityQueryPageInput[]>();
  for (const row of input.queryPages) {
    if (!row.query.trim() || !row.pageUrl.trim()) {
      continue;
    }
    const groupingKey = opportunityQueryKey(row.query);
    if (!groupingKey) {
      continue;
    }
    const members = queryPagesByKey.get(groupingKey) ?? [];
    members.push(row);
    queryPagesByKey.set(groupingKey, members);
  }

  const cards: QueryOpportunityCard[] = [];
  for (const [groupingKey, variants] of groups) {
    const display = pickDisplayQuery(variants);
    const page = leadingPage(queryPagesByKey.get(groupingKey) ?? []);
    if (!display || !page) {
      continue;
    }

    const uniqueVariants = [
      ...new Set(
        [...variants]
          .sort((left, right) => {
            if (right.impressions !== left.impressions) {
              return right.impressions - left.impressions;
            }
            return left.query.localeCompare(right.query);
          })
          .map((row) => row.query),
      ),
    ];

    cards.push({
      id: opportunityId(groupingKey, page.pageUrl),
      query: display.query,
      groupingKey,
      appearances: display.impressions,
      visits: display.clicks,
      position: display.position,
      leadingPageUrl: page.pageUrl,
      leadingPageId: page.pageId,
      mapped: Boolean(page.pageId),
      variants: uniqueVariants,
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
