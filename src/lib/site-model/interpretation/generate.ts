import { getOpenAiApiKey, getOpenAiEnrichmentModel } from "@/lib/ai-enrichment/config";
import {
  OPENAI_RESPONSES_URL,
  buildOpenAiJsonSchemaRequestBody,
  extractResponsesOutputText,
  type OpenAiResponsesPayload,
} from "@/lib/ai-enrichment/providers/openai-responses";
import {
  SITE_INTERPRETATION_PROMPT_VERSION,
  type SiteInterpretationDraft,
  type SiteModelEvidence,
  type SiteModelUnderstanding,
} from "../types";
import { hashSiteInterpretationEvidence } from "./hash";
import {
  SITE_INTERPRETATION_RESPONSE_JSON_SCHEMA,
  SITE_INTERPRETATION_SYSTEM_INSTRUCTIONS,
  buildSiteInterpretationPrompt,
} from "./prompt";
import { validateInterpretationAgainstEvidence } from "./validate";

const INTERPRETATION_TIMEOUT_MS = 20_000;

type ModelInterpretationPayload = {
  siteDescription?: unknown;
  offers?: unknown;
  audiences?: unknown;
  locations?: unknown;
  uncertainty?: unknown;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export async function generateOpenAiSiteInterpretation(input: {
  understanding: SiteModelUnderstanding;
  evidence: SiteModelEvidence;
}): Promise<SiteInterpretationDraft> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = getOpenAiEnrichmentModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INTERPRETATION_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildOpenAiJsonSchemaRequestBody({
          model,
          instructions: SITE_INTERPRETATION_SYSTEM_INSTRUCTIONS,
          userText: buildSiteInterpretationPrompt(input),
          schemaName: SITE_INTERPRETATION_RESPONSE_JSON_SCHEMA.name,
          schema: SITE_INTERPRETATION_RESPONSE_JSON_SCHEMA.schema as unknown as Record<
            string,
            unknown
          >,
        }),
      ),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI Responses API request failed (${response.status}): ${errorText}`,
    );
  }

  const payload = (await response.json()) as OpenAiResponsesPayload;
  const content = extractResponsesOutputText(payload);
  const parsed = JSON.parse(content) as ModelInterpretationPayload;
  const validated = validateInterpretationAgainstEvidence({
    fields: {
      siteDescription:
        typeof parsed.siteDescription === "string" ? parsed.siteDescription : "",
      offers: asStringArray(parsed.offers),
      audiences: asStringArray(parsed.audiences),
      locations: asStringArray(parsed.locations),
    },
    understanding: input.understanding,
  });

  if (!validated.ok) {
    throw new Error(validated.reason);
  }

  const uncertainty = asStringArray(parsed.uncertainty).map((item) => item.trim()).filter(Boolean);

  return {
    promptVersion: SITE_INTERPRETATION_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    generator: "openai",
    status: "ready",
    evidenceHash: hashSiteInterpretationEvidence(input),
    sourceCrawlRunId: input.evidence.crawlRunId,
    siteDescription: validated.fields.siteDescription,
    offers: validated.fields.offers,
    audiences: validated.fields.audiences,
    locations: validated.fields.locations,
    uncertainty,
  };
}
