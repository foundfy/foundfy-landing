import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type {
  AiEnrichmentStatus,
  StoredExplanationEnrichment,
} from "../types";

type ExplanationRow = {
  id: string;
  crawl_run_id: string;
  finding_id: string;
  contextual_explanation: string | null;
  evidence_explanation: string | null;
  cited_evidence_keys: string[];
  input_hash: string;
  model: string;
  prompt_version: string;
  status: AiEnrichmentStatus;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapExplanationRow(row: ExplanationRow): StoredExplanationEnrichment {
  return {
    id: row.id,
    crawlRunId: row.crawl_run_id,
    findingId: row.finding_id,
    contextualExplanation: row.contextual_explanation,
    evidenceExplanation: row.evidence_explanation,
    citedEvidenceKeys: row.cited_evidence_keys ?? [],
    inputHash: row.input_hash,
    model: row.model,
    promptVersion: row.prompt_version,
    status: row.status,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listExplanationEnrichments(
  crawlRunId: string,
): Promise<StoredExplanationEnrichment[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("finding_ai_explanations")
    .select(
      "id, crawl_run_id, finding_id, contextual_explanation, evidence_explanation, cited_evidence_keys, input_hash, model, prompt_version, status, generated_at, created_at, updated_at",
    )
    .eq("crawl_run_id", crawlRunId);

  if (error) {
    throw new Error(`Failed to list explanation enrichments: ${error.message}`);
  }

  return (data ?? []).map((row) => mapExplanationRow(row as ExplanationRow));
}

export async function upsertExplanationEnrichment(input: {
  crawlRunId: string;
  findingId: string;
  contextualExplanation: string | null;
  evidenceExplanation: string | null;
  citedEvidenceKeys: string[];
  inputHash: string;
  model: string;
  promptVersion: string;
  status: AiEnrichmentStatus;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase.from("finding_ai_explanations").upsert(
    {
      crawl_run_id: input.crawlRunId,
      finding_id: input.findingId,
      contextual_explanation: input.contextualExplanation,
      evidence_explanation: input.evidenceExplanation,
      cited_evidence_keys: input.citedEvidenceKeys,
      input_hash: input.inputHash,
      model: input.model,
      prompt_version: input.promptVersion,
      status: input.status,
      generated_at: input.status === "ready" ? now : null,
      updated_at: now,
    },
    {
      onConflict: "crawl_run_id,finding_id",
    },
  );

  if (error) {
    throw new Error(`Failed to upsert explanation enrichment: ${error.message}`);
  }
}
