import { describe, expect, it } from "vitest";
import {
  OPENAI_RESPONSES_URL,
  buildOpenAiResponsesRequestBody,
  extractResponsesOutputText,
  parseExplanationResponseContent,
} from "./openai-responses";

describe("buildOpenAiResponsesRequestBody", () => {
  it("uses the Responses API text.format json_schema shape", () => {
    const body = buildOpenAiResponsesRequestBody({
      model: "gpt-5.6-luna",
      batchInput: {
        crawlRunId: "run-1",
        hostname: "example.com",
        pagesCrawled: 3,
        promptVersion: "explanation-v1",
        findings: [
          {
            findingId: "finding-1",
            ruleKey: "page_fundamentals.missing_title",
            title: "Missing title",
            description: "Desc",
            pageUrl: "https://example.com/",
            whitelistedEvidence: {
              requestedUrl: "https://example.com/",
              finalUrl: "https://example.com/",
            },
            whyItMatters: "Titles matter.",
          },
        ],
      },
    });

    expect(body.model).toBe("gpt-5.6-luna");
    expect(body.store).toBe(false);
    expect(body.temperature).toBeUndefined();
    expect(body.instructions).toContain("grounded SEO finding explanations");
    expect(body.input).toEqual([
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: expect.stringContaining("example.com"),
          },
        ],
      },
    ]);

    const textFormat = (body.text as { format: Record<string, unknown> }).format;
    expect(textFormat.type).toBe("json_schema");
    expect(textFormat.name).toBe("finding_explanations");
    expect(textFormat.strict).toBe(true);
    expect(textFormat.schema).toBeTruthy();
  });
});

describe("extractResponsesOutputText", () => {
  it("reads top-level output_text when present", () => {
    expect(
      extractResponsesOutputText({
        output_text: '{"explanations":[]}',
      }),
    ).toBe('{"explanations":[]}');
  });

  it("falls back to output message content", () => {
    expect(
      extractResponsesOutputText({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: '{"explanations":[]}',
              },
            ],
          },
        ],
      }),
    ).toBe('{"explanations":[]}');
  });
});

describe("parseExplanationResponseContent", () => {
  it("returns the explanations array from structured output", () => {
    const explanations = parseExplanationResponseContent(
      JSON.stringify({
        explanations: [
          {
            findingId: "finding-1",
            contextualExplanation: "Context",
            evidenceExplanation: "Evidence",
            citedEvidenceKeys: ["requestedUrl"],
          },
        ],
      }),
    );

    expect(explanations).toHaveLength(1);
  });
});

describe("OpenAI Responses endpoint", () => {
  it("targets the Responses API route", () => {
    expect(OPENAI_RESPONSES_URL).toBe("https://api.openai.com/v1/responses");
  });
});
