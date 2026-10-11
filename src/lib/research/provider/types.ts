import type {
  ResearchCountry,
  ResearchLanguage,
  ResearchProviderEnvironment,
  ResearchProviderId,
} from "../types";

export type RelatedKeywordIdea = {
  keyword: string;
  searchVolume: number | null;
  providerOrder: number;
};

export type RelatedKeywordIdeasResult = {
  taskId: string | null;
  ideas: RelatedKeywordIdea[];
  providerCost: number | null;
};

export type RelatedKeywordIdeasInput = {
  offering: string;
  locationCode: number;
  languageCode: string;
  limit: number;
};

export interface ResearchProvider {
  readonly id: ResearchProviderId;
  readonly environment: ResearchProviderEnvironment;
  listCountries(): Promise<ResearchCountry[]>;
  listLanguages(): Promise<ResearchLanguage[]>;
  relatedKeywordIdeas(input: RelatedKeywordIdeasInput): Promise<RelatedKeywordIdeasResult>;
}
