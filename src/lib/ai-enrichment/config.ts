export const EXPLANATION_PROMPT_VERSION = "explanation-v1";

export const DEFAULT_OPENAI_ENRICHMENT_MODEL = "gpt-5.6-luna";

export function getOpenAiEnrichmentModel(): string {
  return process.env.OPENAI_ENRICHMENT_MODEL ?? DEFAULT_OPENAI_ENRICHMENT_MODEL;
}

export function isAiEnrichmentEnabled(): boolean {
  return process.env.AI_ENRICHMENT_ENABLED === "true";
}

export function getOpenAiApiKey(): string | null {
  return process.env.OPENAI_API_KEY ?? null;
}
