import {
  isClearlyBrandedQuery,
  opportunityCompactKey,
} from "@/lib/opportunities/normalize";
import { RESEARCH_MAX_IDEAS_PER_REQUEST } from "./config";
import {
  emptyFilterReasonCounts,
  type ResearchFilterReasonCounts,
} from "./filter-reasons";
import { hasDisallowedOfferingCharacters } from "./offerings";

export type ProviderIdeaRow = {
  keyword: string;
  searchVolume: number | null;
  providerOrder: number;
};

export type FilterRelatedIdeasResult = {
  ideas: ProviderIdeaRow[];
  filterReasonCounts: ResearchFilterReasonCounts;
};

function compareIdeas(left: ProviderIdeaRow, right: ProviderIdeaRow): number {
  const leftVolume = left.searchVolume;
  const rightVolume = right.searchVolume;
  if (leftVolume != null && rightVolume != null && leftVolume !== rightVolume) {
    return rightVolume - leftVolume;
  }

  if (leftVolume != null && rightVolume == null) {
    return -1;
  }

  if (leftVolume == null && rightVolume != null) {
    return 1;
  }

  const lexical = left.keyword.localeCompare(right.keyword, "en");
  if (lexical !== 0) {
    return lexical;
  }

  return left.providerOrder - right.providerOrder;
}

export function filterRelatedIdeas(input: {
  ideas: ProviderIdeaRow[];
  seedOffering: string;
  hostname: string;
  limit?: number;
}): FilterRelatedIdeasResult {
  const seedCompact = opportunityCompactKey(input.seedOffering);
  const byCompact = new Map<string, ProviderIdeaRow>();
  const filterReasonCounts = emptyFilterReasonCounts();

  for (const idea of input.ideas) {
    const keyword = idea.keyword.trim().replace(/\s+/g, " ");
    if (!keyword) {
      filterReasonCounts.emptyCount += 1;
      continue;
    }

    if (hasDisallowedOfferingCharacters(keyword)) {
      filterReasonCounts.invalidCount += 1;
      continue;
    }

    if (isClearlyBrandedQuery(keyword, input.hostname)) {
      filterReasonCounts.brandOnlyCount += 1;
      continue;
    }

    const compact = opportunityCompactKey(keyword);
    if (!compact) {
      filterReasonCounts.emptyCount += 1;
      continue;
    }

    if (compact === seedCompact) {
      filterReasonCounts.seedDuplicateCount += 1;
      continue;
    }

    const candidate: ProviderIdeaRow = {
      keyword,
      searchVolume: idea.searchVolume,
      providerOrder: idea.providerOrder,
    };
    const existing = byCompact.get(compact);
    if (!existing) {
      byCompact.set(compact, candidate);
      continue;
    }

    filterReasonCounts.compactDuplicateCount += 1;
    if (compareIdeas(candidate, existing) < 0) {
      byCompact.set(compact, candidate);
    }
  }

  const ranked = [...byCompact.values()].sort(compareIdeas);
  const limit = input.limit ?? RESEARCH_MAX_IDEAS_PER_REQUEST;
  const ideas = ranked.slice(0, limit);
  filterReasonCounts.cappedCount = ranked.length - ideas.length;

  return { ideas, filterReasonCounts };
}
