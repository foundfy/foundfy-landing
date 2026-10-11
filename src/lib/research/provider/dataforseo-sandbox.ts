import { ResearchProviderError } from "../errors";
import type { ResearchCountry, ResearchLanguage } from "../types";
import { createDataForSeoClient, type DataForSeoFetch } from "./dataforseo-client";
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
  DATAFORSEO_SANDBOX_ORIGIN,
} from "./hosts";
import type {
  RelatedKeywordIdeasInput,
  RelatedKeywordIdeasResult,
  ResearchProvider,
} from "./types";

export class DataForSeoSandboxResearchProvider implements ResearchProvider {
  readonly id = "dataforseo" as const;
  readonly environment = "sandbox" as const;
  private readonly client;

  constructor(input: { login: string; password: string; fetchImpl?: DataForSeoFetch }) {
    this.client = createDataForSeoClient({
      origin: DATAFORSEO_SANDBOX_ORIGIN,
      login: input.login,
      password: input.password,
      fetchImpl: input.fetchImpl,
    });
    if (this.client.origin !== DATAFORSEO_SANDBOX_ORIGIN) {
      throw new ResearchProviderError("host_rejected", "Sandbox provider host is locked.");
    }
  }

  get origin(): string {
    return this.client.origin;
  }

  async listCountries(): Promise<ResearchCountry[]> {
    const payload = await this.client.post(DATAFORSEO_LOCATIONS_PATH, []);
    return parseLocationsResponse(payload);
  }

  async listLanguages(): Promise<ResearchLanguage[]> {
    const payload = await this.client.post(DATAFORSEO_LANGUAGES_PATH, []);
    return parseLanguagesResponse(payload);
  }

  async relatedKeywordIdeas(input: RelatedKeywordIdeasInput): Promise<RelatedKeywordIdeasResult> {
    const payload = await this.client.post(DATAFORSEO_KEYWORDS_FOR_KEYWORDS_PATH, [
      buildKeywordsForKeywordsTask(input),
    ]);
    return parseKeywordsForKeywordsResponse(payload);
  }
}
