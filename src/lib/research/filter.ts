import {
  isClearlyBrandedQuery,
  opportunityCompactKey,
} from "@/lib/opportunities/normalize";
import { RESEARCH_MAX_IDEAS_PER_REQUEST } from "./config";
import { hasDisallowedOfferingCharacters } from "./offerings";

export type ProviderIdeaRow = {
  keyword: string;
  searchVolume: number | null;
  providerOrder: number;
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
}): ProviderIdeaRow[] {
  const seedCompact = opportunityCompactKey(input.seedOffering);
  const byCompact = new Map<string, ProviderIdeaRow>();

  for (const idea of input.ideas) {
    const keyword = idea.keyword.trim().replace(/\s+/g, " ");
    if (!keyword) {
      continue;
    }

    if (hasDisallowedOfferingCharacters(keyword)) {
      continue;
    }

    if (isClearlyBrandedQuery(keyword, input.hostname)) {
      continue;
    }

    const compact = opportunityCompactKey(keyword);
    if (!compact || compact === seedCompact) {
      continue;
    }

    const candidate: ProviderIdeaRow = {
      keyword,
      searchVolume: idea.searchVolume,
      providerOrder: idea.providerOrder,
    };
    const existing = byCompact.get(compact);
    if (!existing || compareIdeas(candidate, existing) < 0) {
      byCompact.set(compact, candidate);
    }
  }

  return [...byCompact.values()]
    .sort(compareIdeas)
    .slice(0, input.limit ?? RESEARCH_MAX_IDEAS_PER_REQUEST);
}
