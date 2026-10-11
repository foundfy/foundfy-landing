import { ResearchProviderError } from "../errors";
import type { ResearchCountry, ResearchLanguage } from "../types";
import { FIXTURE_RESEARCH_COUNTRIES, FIXTURE_RESEARCH_LANGUAGES } from "./fixture-metadata";
import type {
  RelatedKeywordIdeasInput,
  RelatedKeywordIdeasResult,
  ResearchProvider,
} from "./types";

export type FixtureRelatedBehavior =
  | "normal"
  | "null_volume"
  | "duplicates"
  | "brand"
  | "seed_duplicate"
  | "empty"
  | "malformed"
  | "rate_limit"
  | "timeout"
  | "fail";

function fixtureKey(input: RelatedKeywordIdeasInput): string {
  return `${input.offering}\t${input.languageCode}`;
}

export class FixtureResearchProvider implements ResearchProvider {
  readonly id = "fixture" as const;
  readonly environment = "fixture" as const;

  constructor(
    private readonly behaviors: Map<string, FixtureRelatedBehavior> = new Map(),
  ) {}

  setBehavior(offering: string, languageCode: string, behavior: FixtureRelatedBehavior): void {
    this.behaviors.set(`${offering}\t${languageCode}`, behavior);
  }

  async listCountries(): Promise<ResearchCountry[]> {
    return FIXTURE_RESEARCH_COUNTRIES;
  }

  async listLanguages(): Promise<ResearchLanguage[]> {
    return FIXTURE_RESEARCH_LANGUAGES;
  }

  async relatedKeywordIdeas(input: RelatedKeywordIdeasInput): Promise<RelatedKeywordIdeasResult> {
    const behavior = this.behaviors.get(fixtureKey(input)) ?? "normal";
    if (behavior === "rate_limit") {
      throw new ResearchProviderError("rate_limited", "Fixture rate limit.", true);
    }

    if (behavior === "timeout") {
      throw new ResearchProviderError("timeout", "Fixture timeout.", true);
    }

    if (behavior === "fail") {
      throw new ResearchProviderError("server_error", "Fixture provider failure.", true);
    }

    if (behavior === "empty") {
      return { taskId: "fixture-task-empty", ideas: [], providerCost: 0 };
    }

    const ideas = fixtureIdeas(input, behavior);
    return {
      taskId: `fixture-task-${input.languageCode}`,
      ideas,
      providerCost: 0,
    };
  }
}

function fixtureIdeas(
  input: RelatedKeywordIdeasInput,
  behavior: FixtureRelatedBehavior,
): RelatedKeywordIdeasResult["ideas"] {
  const seed = input.offering;
  if (behavior === "malformed") {
    return [
      { keyword: "", searchVolume: 10, providerOrder: 0 },
      { keyword: "fixture related term", searchVolume: 20, providerOrder: 1 },
    ];
  }

  if (behavior === "null_volume") {
    return [{ keyword: "fixture related term no volume", searchVolume: null, providerOrder: 0 }];
  }

  if (behavior === "duplicates") {
    return [
      { keyword: "fixture related silk", searchVolume: 40, providerOrder: 0 },
      { keyword: "Fixture Related Silk", searchVolume: 80, providerOrder: 1 },
      { keyword: "fixture-related silk", searchVolume: 80, providerOrder: 2 },
    ];
  }

  if (behavior === "brand") {
    return [
      { keyword: "dbhobby", searchVolume: 90, providerOrder: 0 },
      { keyword: "fixture related term", searchVolume: 30, providerOrder: 1 },
    ];
  }

  if (behavior === "seed_duplicate") {
    return [
      { keyword: seed, searchVolume: 100, providerOrder: 0 },
      { keyword: "fixture related term", searchVolume: 25, providerOrder: 1 },
    ];
  }

  return [
    { keyword: seed, searchVolume: 12, providerOrder: 0 },
    { keyword: "fixture related term one", searchVolume: 50, providerOrder: 1 },
    { keyword: "fixture related term two", searchVolume: null, providerOrder: 2 },
    { keyword: "fixture related term one", searchVolume: 20, providerOrder: 3 },
  ];
}
