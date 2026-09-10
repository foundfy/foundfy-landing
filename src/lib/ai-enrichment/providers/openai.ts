import { getOpenAiApiKey, getOpenAiEnrichmentModel } from "../config";
import type { ExplanationBatchInput, ExplanationProvider } from "../types";
import {
  OPENAI_RESPONSES_URL,
  buildOpenAiResponsesRequestBody,
  extractResponsesOutputText,
  parseExplanationResponseContent,
  type OpenAiResponsesPayload,
} from "./openai-responses";

export function createOpenAiExplanationProvider(): ExplanationProvider {
  const model = getOpenAiEnrichmentModel();

  return {
    model,
    async generateExplanations(input: ExplanationBatchInput) {
      const apiKey = getOpenAiApiKey();
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured.");
      }

      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildOpenAiResponsesRequestBody({
            model,
            batchInput: input,
          }),
        ),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenAI Responses API request failed (${response.status}): ${errorText}`,
        );
      }

      const payload = (await response.json()) as OpenAiResponsesPayload;
      const content = extractResponsesOutputText(payload);

      return parseExplanationResponseContent(content);
    },
  };
}
