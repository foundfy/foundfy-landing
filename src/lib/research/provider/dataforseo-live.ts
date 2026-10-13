import { isResearchLiveEnabled } from "../config";
import { ResearchProviderError } from "../errors";
import type { ResearchCountry, ResearchLanguage } from "../types";
import { createDataForSeoClient, type DataForSeoFetch } from "./dataforseo-client";
import { loadDataForSeoMetadata } from "./dataforseo-diagnostics";
import {
  buildKeywordsForKeywordsTask,
  parseKeywordsForKeywordsResponse,
  parseLanguagesResponse,
  parseLocationsResponse,
} from "./dataforseo-parse";
import {
  DATAFORSEO_KEYWORDS_FOR_KEYWORDS_PATH,
  DATAFORSEO_LANGUAGES_PATH,
  DATAFORSEO_LOCATIONS_PATH,
  DATAFORSEO_LIVE_ORIGIN,
} from "./hosts";
import type {
  RelatedKeywordIdeasInput,
  RelatedKeywordIdeasResult,
  ResearchProvider,
} from "./types";

export class DataForSeoLiveResearchProvider implements ResearchProvider {
  readonly id = "dataforseo" as const;
  readonly environment = "live" as const;
  private readonly client;

  constructor(input: {
    login: string;
    password: string;
    fetchImpl?: DataForSeoFetch;
    liveEnabled?: boolean;
    env?: NodeJS.ProcessEnv;
  }) {
    const liveEnabled = input.liveEnabled ?? isResearchLiveEnabled(input.env ?? process.env);
    if (!liveEnabled) {
      throw new ResearchProviderError("live_not_enabled", "Live RESEARCH is not enabled.");
    }

    this.client = createDataForSeoClient({
      origin: DATAFORSEO_LIVE_ORIGIN,
      login: input.login,
      password: input.password,
      fetchImpl: input.fetchImpl,
    });
    if (this.client.origin !== DATAFORSEO_LIVE_ORIGIN) {
      throw new ResearchProviderError("host_rejected", "Live provider host is locked.");
    }
  }

  get origin(): string {
    return this.client.origin;
  }

  async listCountries(): Promise<ResearchCountry[]> {
    return loadDataForSeoMetadata({
      category: "locations",
      request: () => this.client.post(DATAFORSEO_LOCATIONS_PATH, []),
      parse: parseLocationsResponse,
    });
  }

  async listLanguages(): Promise<ResearchLanguage[]> {
    return loadDataForSeoMetadata({
      category: "languages",
      request: () => this.client.post(DATAFORSEO_LANGUAGES_PATH, []),
      parse: parseLanguagesResponse,
    });
  }

  async relatedKeywordIdeas(input: RelatedKeywordIdeasInput): Promise<RelatedKeywordIdeasResult> {
    const payload = await this.client.post(DATAFORSEO_KEYWORDS_FOR_KEYWORDS_PATH, [
      buildKeywordsForKeywordsTask(input),
    ]);
    return parseKeywordsForKeywordsResponse(payload);
  }
}
