import type { ExplanationBatchInput } from "../types";
import {
  EXPLANATION_RESPONSE_JSON_SCHEMA,
  buildExplanationPrompt,
} from "../explanation/prompt";
import { EXPLANATION_PROMPT_VERSION } from "../config";

export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export const EXPLANATION_SYSTEM_INSTRUCTIONS =
  "You produce grounded SEO finding explanations for Foundfy. Never invent unsupported facts.";

type ResponsesOutputTextPart = {
  type: "output_text";
  text?: string;
};

type ResponsesOutputMessage = {
  type: "message";
  content?: ResponsesOutputTextPart[];
};

export type OpenAiResponsesPayload = {
  output_text?: string;
  output?: ResponsesOutputMessage[];
  error?: {
    message?: string;
  } | null;
};

export function buildOpenAiJsonSchemaRequestBody(input: {
  model: string;
  instructions: string;
  userText: string;
  schemaName: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}): Record<string, unknown> {
  return {
    model: input.model,
    instructions: input.instructions,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: input.userText,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: input.schemaName,
        strict: input.strict ?? true,
        schema: input.schema,
      },
    },
    store: false,
  };
}

export function buildOpenAiResponsesRequestBody(input: {
  model: string;
  batchInput: ExplanationBatchInput;
}): Record<string, unknown> {
  return buildOpenAiJsonSchemaRequestBody({
    model: input.model,
    instructions: EXPLANATION_SYSTEM_INSTRUCTIONS,
    userText: buildExplanationPrompt({
      ...input.batchInput,
      promptVersion: EXPLANATION_PROMPT_VERSION,
    }),
    schemaName: EXPLANATION_RESPONSE_JSON_SCHEMA.name,
    schema: EXPLANATION_RESPONSE_JSON_SCHEMA.schema as unknown as Record<
      string,
      unknown
    >,
    strict: EXPLANATION_RESPONSE_JSON_SCHEMA.strict,
  });
}

export function extractResponsesOutputText(
  payload: OpenAiResponsesPayload,
): string {
  if (typeof payload.output_text === "string" && payload.output_text.length > 0) {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    if (item.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }

    for (const part of item.content) {
      if (part.type === "output_text" && typeof part.text === "string") {
        return part.text;
      }
    }
  }

  throw new Error("OpenAI Responses API payload did not include output text.");
}

export function parseExplanationResponseContent(content: string): unknown[] {
  const parsed = JSON.parse(content) as { explanations?: unknown };

  if (!Array.isArray(parsed.explanations)) {
    throw new Error("OpenAI response did not include explanations array.");
  }

  return parsed.explanations;
}
