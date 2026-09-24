import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { DECISION_ENGINE_VERSION } from "./config";
import type {
  DecisionRecord,
  DecisionRunRecord,
  DecisionRunStatus,
  GoalSnapshot,
  RankedDecision,
} from "./types";

type RunRow = {
  id: string;
  website_id: string;
  site_model_id: string;
  crawl_run_id: string;
  gsc_search_sync_id: string;
  engine_version: string;
  status: DecisionRunStatus;
  goal_id: string;
  goal_snapshot: GoalSnapshot;
  gsc_truncated: boolean;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
};

type DecisionRow = {
  id: string;
  decision_run_id: string;
  website_id: string;
  decision_type: DecisionRecord["decisionType"];
  title: string;
  explanation: string;
  page_url: string | null;
  page_id: string | null;
  priority_band: DecisionRecord["priorityBand"];
  rank: number;
  scoring: DecisionRecord["scoring"];
  confidence: DecisionRecord["confidence"];
  created_at: string;
};

const RUN_COLUMNS =
  "id, website_id, site_model_id, crawl_run_id, gsc_search_sync_id, engine_version, status, goal_id, goal_snapshot, gsc_truncated, error_code, created_at, completed_at";

const DECISION_COLUMNS =
  "id, decision_run_id, website_id, decision_type, title, explanation, page_url, page_id, priority_band, rank, scoring, confidence, created_at";

function mapRun(row: RunRow): DecisionRunRecord {
  return {
    id: row.id,
    websiteId: row.website_id,
    siteModelId: row.site_model_id,
    crawlRunId: row.crawl_run_id,
    gscSearchSyncId: row.gsc_search_sync_id,
    engineVersion: row.engine_version,
    status: row.status,
    goalId: row.goal_id,
    goalSnapshot: row.goal_snapshot,
    gscTruncated: row.gsc_truncated,
    errorCode: row.error_code,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function mapDecision(row: DecisionRow, evidenceRefs: DecisionRecord["evidenceRefs"]): DecisionRecord {
  return {
    id: row.id,
    decisionRunId: row.decision_run_id,
    websiteId: row.website_id,
    decisionType: row.decision_type,
    title: row.title,
    explanation: row.explanation,
    pageUrl: row.page_url,
    pageId: row.page_id,
    priorityBand: row.priority_band,
    rank: row.rank,
    scoring: row.scoring,
    confidence: row.confidence,
    createdAt: row.created_at,
    evidenceRefs,
  };
}

export async function insertRunningDecisionRun(input: {
  websiteId: string;
  siteModelId: string;
  crawlRunId: string;
  gscSearchSyncId: string;
  goal: GoalSnapshot;
  gscTruncated: boolean;
}): Promise<DecisionRunRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("decision_runs")
    .insert({
      website_id: input.websiteId,
      site_model_id: input.siteModelId,
      crawl_run_id: input.crawlRunId,
      gsc_search_sync_id: input.gscSearchSyncId,
      engine_version: DECISION_ENGINE_VERSION,
      status: "running",
      goal_id: input.goal.id,
      goal_snapshot: input.goal,
      gsc_truncated: input.gscTruncated,
    })
    .select(RUN_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to start Decision Engine run: ${error?.message ?? "unknown error"}`);
  }

  return mapRun(data as RunRow);
}

export async function completeDecisionRun(input: {
  id: string;
  websiteId: string;
  decisions: RankedDecision[];
}): Promise<{ run: DecisionRunRecord; decisions: DecisionRecord[] }> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const inserted: DecisionRecord[] = [];
  for (const decision of input.decisions) {
    const { data, error } = await supabase
      .from("decisions")
      .insert({
        decision_run_id: input.id,
        website_id: input.websiteId,
        decision_type: decision.decisionType,
        title: decision.title,
        explanation: decision.explanation,
        page_url: decision.pageUrl,
        page_id: decision.pageId,
        priority_band: decision.priorityBand,
        rank: decision.rank,
        scoring: decision.scoring,
        confidence: decision.confidence,
      })
      .select(DECISION_COLUMNS)
      .maybeSingle();

    if (error || !data) {
      throw new Error(`Failed to store decision: ${error?.message ?? "unknown error"}`);
    }

    if (decision.evidenceRefs.length > 0) {
      const { error: refError } = await supabase.from("decision_evidence_refs").insert(
        decision.evidenceRefs.map((ref) => ({
          decision_id: (data as DecisionRow).id,
          kind: ref.kind,
          record_id: ref.recordId,
          snapshot: ref.snapshot,
        })),
      );

      if (refError) {
        throw new Error(`Failed to store decision evidence: ${refError.message}`);
      }
    }

    inserted.push(mapDecision(data as DecisionRow, decision.evidenceRefs));
  }

  const { data: run, error } = await supabase
    .from("decision_runs")
    .update({ status: "completed", completed_at: now, error_code: null })
    .eq("id", input.id)
    .eq("status", "running")
    .select(RUN_COLUMNS)
    .maybeSingle();

  if (error || !run) {
    throw new Error(`Failed to complete Decision Engine run: ${error?.message ?? "unknown error"}`);
  }

  return { run: mapRun(run as RunRow), decisions: inserted };
}

export async function failDecisionRun(id: string, errorCode: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("decision_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_code: errorCode,
    })
    .eq("id", id)
    .eq("status", "running");

  if (error) {
    throw new Error(`Failed to mark Decision Engine run failed: ${error.message}`);
  }
}

export async function markWebsiteDecisionRunsStale(
  websiteId: string,
  exceptRunId?: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("decision_runs")
    .update({ status: "stale" })
    .eq("website_id", websiteId)
    .eq("status", "completed");

  if (exceptRunId) {
    query = query.neq("id", exceptRunId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to stale Decision Engine runs: ${error.message}`);
  }
}

export async function findLatestCompletedDecisionRun(
  websiteId: string,
): Promise<DecisionRunRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("decision_runs")
    .select(RUN_COLUMNS)
    .eq("website_id", websiteId)
    .eq("status", "completed")
    .eq("engine_version", DECISION_ENGINE_VERSION)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Decision Engine run: ${error.message}`);
  }

  return data ? mapRun(data as RunRow) : null;
}

export async function listDecisionsForRun(runId: string): Promise<DecisionRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("decisions")
    .select(DECISION_COLUMNS)
    .eq("decision_run_id", runId)
    .order("rank", { ascending: true });

  if (error) {
    throw new Error(`Failed to load decisions: ${error.message}`);
  }

  const rows = (data ?? []) as DecisionRow[];
  if (rows.length === 0) {
    return [];
  }

  const { data: refs, error: refsError } = await supabase
    .from("decision_evidence_refs")
    .select("decision_id, kind, record_id, snapshot")
    .in(
      "decision_id",
      rows.map((row) => row.id),
    );

  if (refsError) {
    throw new Error(`Failed to load decision evidence: ${refsError.message}`);
  }

  const refsByDecision = new Map<string, DecisionRecord["evidenceRefs"]>();
  for (const ref of refs ?? []) {
    const list = refsByDecision.get(ref.decision_id) ?? [];
    list.push({
      kind: ref.kind,
      recordId: ref.record_id,
      snapshot: (ref.snapshot ?? {}) as Record<string, unknown>,
    });
    refsByDecision.set(ref.decision_id, list);
  }

  return rows.map((row) => mapDecision(row, refsByDecision.get(row.id) ?? []));
}

export async function deleteDecisionEngineForWebsite(websiteId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("decision_runs").delete().eq("website_id", websiteId);
  if (error) {
    throw new Error(`Failed to delete Decision Engine data: ${error.message}`);
  }
}
