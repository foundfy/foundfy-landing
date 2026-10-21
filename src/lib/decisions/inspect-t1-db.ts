import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type { DecisionEvidenceRef, ResearchInspectState } from "./types";

export type PersistResearchInspectDecisionWithObservationInput = {
  researchIdeaId: string;
  siteModelId: string;
  crawlRunId: string;
  gscSearchSyncId: string | null;
  targetedObservationId: string;
  title: string;
  explanation: string;
  pageUrl: string | null;
  pageId: string | null;
  inspectionState: ResearchInspectState;
  gscTruncated: boolean;
  evidenceRefs: DecisionEvidenceRef[];
};

export type PersistResearchInspectDecisionWithObservationResult = {
  reused: boolean;
  runId: string;
  decisionId: string;
};

export async function persistResearchInspectDecisionWithObservation(
  input: PersistResearchInspectDecisionWithObservationInput,
): Promise<PersistResearchInspectDecisionWithObservationResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc(
    "persist_research_inspect_decision_with_observation",
    {
      p_research_idea_id: input.researchIdeaId,
      p_site_model_id: input.siteModelId,
      p_crawl_run_id: input.crawlRunId,
      p_gsc_search_sync_id: input.gscSearchSyncId,
      p_targeted_observation_id: input.targetedObservationId,
      p_title: input.title,
      p_explanation: input.explanation,
      p_page_url: input.pageUrl,
      p_page_id: input.pageId,
      p_inspection_state: input.inspectionState,
      p_gsc_truncated: input.gscTruncated,
      p_evidence_refs: input.evidenceRefs.map((ref) => ({
        kind: ref.kind,
        record_id: ref.recordId,
        snapshot: ref.snapshot,
      })),
    },
  );

  if (error || !data || typeof data !== "object") {
    throw new Error(
      `Failed to persist targeted observation inspection: ${error?.message ?? "unknown error"}`,
    );
  }

  const payload = data as { reused?: unknown; run_id?: unknown; decision_id?: unknown };
  if (typeof payload.run_id !== "string" || typeof payload.decision_id !== "string") {
    throw new Error("Failed to persist targeted observation inspection: invalid response");
  }

  return {
    reused: payload.reused === true,
    runId: payload.run_id,
    decisionId: payload.decision_id,
  };
}
