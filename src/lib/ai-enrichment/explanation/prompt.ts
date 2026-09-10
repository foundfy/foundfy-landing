import type { ExplanationBatchInput } from "../types";

export function buildExplanationPrompt(input: ExplanationBatchInput): string {
  return [
    "You enrich Foundfy SEO findings with clearer plain-English explanations.",
    "Rules:",
    "- Use only the supplied finding data and whitelisted evidence.",
    "- Do not invent findings, metrics, rankings, traffic, keyword volume, or revenue impact.",
    "- Do not change priority or severity.",
    "- Rewrite whyItMatters in clearer language for the page/site context.",
    "- Explain the supplied evidence in plain English.",
    "- citedEvidenceKeys must only contain keys present in whitelistedEvidence.",
    "- If evidence is limited, say what is known and what is not.",
    "",
    "Return JSON matching the schema exactly.",
    "",
    JSON.stringify(
      {
        crawlRunId: input.crawlRunId,
        hostname: input.hostname,
        pagesCrawled: input.pagesCrawled,
        findings: input.findings,
      },
      null,
      2,
    ),
  ].join("\n");
}

export const EXPLANATION_RESPONSE_JSON_SCHEMA = {
  name: "finding_explanations",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      explanations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            findingId: { type: "string" },
            contextualExplanation: { type: "string" },
            evidenceExplanation: { type: "string" },
            citedEvidenceKeys: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: [
            "findingId",
            "contextualExplanation",
            "evidenceExplanation",
            "citedEvidenceKeys",
          ],
        },
      },
    },
    required: ["explanations"],
  },
} as const;
