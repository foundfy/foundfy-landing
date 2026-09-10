import type { ExplanationInputFinding, ExplanationModelOutput } from "./types";

export type ValidationIssue = {
  code: string;
  message: string;
};

export type ValidationResult =
  | { ok: true; value: ExplanationModelOutput }
  | { ok: false; issues: ValidationIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractNumbers(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

function buildGroundingCorpus(input: {
  finding: ExplanationInputFinding;
  pagesCrawled: number;
}): string {
  return JSON.stringify({
    pagesCrawled: input.pagesCrawled,
    pageUrl: input.finding.pageUrl,
    description: input.finding.description,
    whyItMatters: input.finding.whyItMatters,
    whitelistedEvidence: input.finding.whitelistedEvidence,
  });
}

function numbersAreGrounded(text: string, corpus: string): boolean {
  const numbers = extractNumbers(text);

  for (const number of numbers) {
    if (!corpus.includes(number)) {
      return false;
    }
  }

  return true;
}

export type ParsedExplanationPayload =
  | { ok: true; explanations: ExplanationModelOutput[] }
  | { ok: false; issues: ValidationIssue[] };

export function parseExplanationModelPayload(
  payload: unknown,
): ParsedExplanationPayload {
  if (!Array.isArray(payload)) {
    return {
      ok: false,
      issues: [{ code: "invalid_shape", message: "Model output must be an array." }],
    };
  }

  const parsed: ExplanationModelOutput[] = [];

  for (const item of payload) {
    if (!isRecord(item)) {
      return {
        ok: false,
        issues: [{ code: "invalid_item", message: "Each explanation must be an object." }],
      };
    }

    if (typeof item.findingId !== "string") {
      return {
        ok: false,
        issues: [{ code: "missing_finding_id", message: "findingId is required." }],
      };
    }

    if (typeof item.contextualExplanation !== "string") {
      return {
        ok: false,
        issues: [
          {
            code: "missing_contextual_explanation",
            message: "contextualExplanation is required.",
          },
        ],
      };
    }

    if (typeof item.evidenceExplanation !== "string") {
      return {
        ok: false,
        issues: [
          {
            code: "missing_evidence_explanation",
            message: "evidenceExplanation is required.",
          },
        ],
      };
    }

    if (!Array.isArray(item.citedEvidenceKeys)) {
      return {
        ok: false,
        issues: [
          {
            code: "missing_cited_evidence_keys",
            message: "citedEvidenceKeys must be an array.",
          },
        ],
      };
    }

    if (
      !item.citedEvidenceKeys.every((key) => typeof key === "string")
    ) {
      return {
        ok: false,
        issues: [
          {
            code: "invalid_cited_evidence_keys",
            message: "citedEvidenceKeys must contain strings.",
          },
        ],
      };
    }

    parsed.push({
      findingId: item.findingId,
      contextualExplanation: item.contextualExplanation.trim(),
      evidenceExplanation: item.evidenceExplanation.trim(),
      citedEvidenceKeys: item.citedEvidenceKeys,
    });
  }

  return { ok: true, explanations: parsed };
}

export function validateExplanationOutput(input: {
  output: ExplanationModelOutput;
  finding: ExplanationInputFinding;
  pagesCrawled: number;
  allowedFindingIds: Set<string>;
}): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!input.allowedFindingIds.has(input.output.findingId)) {
    issues.push({
      code: "unknown_finding_id",
      message: "Explanation referenced an unknown finding ID.",
    });
  }

  if (input.output.findingId !== input.finding.findingId) {
    issues.push({
      code: "finding_id_mismatch",
      message: "Explanation finding ID does not match the requested finding.",
    });
  }

  if (input.output.contextualExplanation.length === 0) {
    issues.push({
      code: "empty_contextual_explanation",
      message: "contextualExplanation cannot be empty.",
    });
  }

  if (input.output.evidenceExplanation.length === 0) {
    issues.push({
      code: "empty_evidence_explanation",
      message: "evidenceExplanation cannot be empty.",
    });
  }

  const evidenceKeys = Object.keys(input.finding.whitelistedEvidence);

  for (const citedKey of input.output.citedEvidenceKeys) {
    if (!evidenceKeys.includes(citedKey)) {
      issues.push({
        code: "unknown_evidence_citation",
        message: `Cited evidence key "${citedKey}" was not supplied.`,
      });
    }
  }

  const corpus = buildGroundingCorpus({
    finding: input.finding,
    pagesCrawled: input.pagesCrawled,
  });

  if (
    !numbersAreGrounded(input.output.contextualExplanation, corpus) ||
    !numbersAreGrounded(input.output.evidenceExplanation, corpus)
  ) {
    issues.push({
      code: "ungrounded_numeric_claim",
      message: "Explanation contains numeric claims not present in supplied evidence.",
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, value: input.output };
}
