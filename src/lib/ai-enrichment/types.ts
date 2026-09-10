import type { RuleKey } from "@/lib/observations/types";

export type AiEnrichmentStatus = "pending" | "ready" | "failed" | "skipped";

export type ExplanationEnrichmentStatus =
  | "disabled"
  | "skipped"
  | "pending"
  | "ready"
  | "failed";

export type ExplanationInputFinding = {
  findingId: string;
  ruleKey: RuleKey;
  title: string;
  description: string;
  pageUrl: string | null;
  whitelistedEvidence: Record<string, unknown>;
  whyItMatters: string | null;
};

export type ExplanationBatchInput = {
  crawlRunId: string;
  hostname: string;
  pagesCrawled: number;
  promptVersion: string;
  findings: ExplanationInputFinding[];
};

export type ExplanationModelOutput = {
  findingId: string;
  contextualExplanation: string;
  evidenceExplanation: string;
  citedEvidenceKeys: string[];
};

export type StoredExplanationEnrichment = {
  id: string;
  crawlRunId: string;
  findingId: string;
  contextualExplanation: string | null;
  evidenceExplanation: string | null;
  citedEvidenceKeys: string[];
  inputHash: string;
  model: string;
  promptVersion: string;
  status: AiEnrichmentStatus;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExplanationProvider = {
  model: string;
  generateExplanations: (
    input: ExplanationBatchInput,
  ) => Promise<unknown>;
};
