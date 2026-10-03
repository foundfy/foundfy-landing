import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type { DecisionEvidenceRef } from "@/lib/decisions/types";
import { OPEN_ACTION_STATUSES } from "./config";
import type {
  ActionAttemptRecord,
  ActionEvidenceRef,
  ActionMutationSpec,
  ActionRecord,
  ActionStatus,
} from "./types";

type ActionRow = {
  id: string;
  website_id: string;
  decision_id: string;
  decision_run_id: string;
  owner_id: string;
  action_type: ActionRecord["actionType"];
  target_page_id: string;
  target_page_url: string;
  field: ActionRecord["field"];
  observed_before: string | null;
  proposed_value: string | null;
  mutation_spec: ActionMutationSpec;
  page_content_hash_at_prepare: string | null;
  crawl_run_id: string;
  gsc_sync_id: string;
  site_model_id: string;
  goal_id: string;
  status: ActionStatus;
  approved_by_owner_id: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

type AttemptRow = {
  id: string;
  action_id: string;
  attempt_number: number;
  idempotency_key: string;
  provider: string | null;
  result: ActionAttemptRecord["result"];
  error_code: string | null;
  artifact: ActionAttemptRecord["artifact"];
  created_at: string;
  finished_at: string | null;
};

export type ActionPageSnapshot = {
  id: string;
  crawlRunId: string;
  requestedUrl: string;
  finalUrl: string;
  metaDescription: string | null;
  contentHash: string | null;
};

export type ActionObservationSnapshot = {
  id: string;
  pageId: string | null;
  ruleKey: string;
  status: string;
  evidence: Record<string, unknown>;
};

const ACTION_COLUMNS =
  "id, website_id, decision_id, decision_run_id, owner_id, action_type, target_page_id, target_page_url, field, observed_before, proposed_value, mutation_spec, page_content_hash_at_prepare, crawl_run_id, gsc_sync_id, site_model_id, goal_id, status, approved_by_owner_id, approved_at, created_at, updated_at";

function mapAction(row: ActionRow, evidenceRefs: ActionEvidenceRef[]): ActionRecord {
  return {
    id: row.id,
    websiteId: row.website_id,
    decisionId: row.decision_id,
    decisionRunId: row.decision_run_id,
    ownerId: row.owner_id,
    actionType: row.action_type,
    targetPageId: row.target_page_id,
    targetPageUrl: row.target_page_url,
    field: row.field,
    observedBefore: row.observed_before,
    proposedValue: row.proposed_value,
    mutationSpec: row.mutation_spec,
    pageContentHashAtPrepare: row.page_content_hash_at_prepare,
    crawlRunId: row.crawl_run_id,
    gscSyncId: row.gsc_sync_id,
    siteModelId: row.site_model_id,
    goalId: row.goal_id,
    status: row.status,
    approvedByOwnerId: row.approved_by_owner_id,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    evidenceRefs,
  };
}

function mapAttempt(row: AttemptRow): ActionAttemptRecord {
  return {
    id: row.id,
    actionId: row.action_id,
    attemptNumber: row.attempt_number,
    idempotencyKey: row.idempotency_key,
    provider: row.provider,
    result: row.result,
    errorCode: row.error_code,
    artifact: (row.artifact ?? {}) as ActionAttemptRecord["artifact"],
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

async function loadEvidenceRefs(actionIds: string[]): Promise<Map<string, ActionEvidenceRef[]>> {
  const refsByAction = new Map<string, ActionEvidenceRef[]>();
  if (actionIds.length === 0) {
    return refsByAction;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("action_evidence_refs")
    .select("action_id, kind, record_id, snapshot")
    .in("action_id", actionIds);

  if (error) {
    throw new Error(`Failed to load action evidence: ${error.message}`);
  }

  for (const ref of data ?? []) {
    const list = refsByAction.get(ref.action_id) ?? [];
    list.push({
      kind: ref.kind,
      recordId: ref.record_id,
      snapshot: (ref.snapshot ?? {}) as Record<string, unknown>,
    });
    refsByAction.set(ref.action_id, list);
  }

  return refsByAction;
}

export async function findPageSnapshot(pageId: string): Promise<ActionPageSnapshot | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pages")
    .select("id, crawl_run_id, requested_url, final_url, meta_description, content_hash")
    .eq("id", pageId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load page for action: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    crawlRunId: data.crawl_run_id,
    requestedUrl: data.requested_url,
    finalUrl: data.final_url,
    metaDescription: data.meta_description,
    contentHash: data.content_hash,
  };
}

export async function findObservationSnapshot(
  observationId: string,
): Promise<ActionObservationSnapshot | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("observations")
    .select("id, page_id, rule_key, status, evidence")
    .eq("id", observationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load observation for action: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    pageId: data.page_id,
    ruleKey: data.rule_key,
    status: data.status,
    evidence: (data.evidence ?? {}) as Record<string, unknown>,
  };
}

export async function insertAction(input: {
  websiteId: string;
  decisionId: string;
  decisionRunId: string;
  ownerId: string;
  targetPageId: string;
  targetPageUrl: string;
  observedBefore: string | null;
  proposedValue: string | null;
  mutationSpec: ActionMutationSpec;
  pageContentHashAtPrepare: string | null;
  crawlRunId: string;
  gscSyncId: string;
  siteModelId: string;
  goalId: string;
  evidenceRefs: DecisionEvidenceRef[];
}): Promise<ActionRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("actions")
    .insert({
      website_id: input.websiteId,
      decision_id: input.decisionId,
      decision_run_id: input.decisionRunId,
      owner_id: input.ownerId,
      action_type: "update_meta_description",
      target_page_id: input.targetPageId,
      target_page_url: input.targetPageUrl,
      field: "meta_description",
      observed_before: input.observedBefore,
      proposed_value: input.proposedValue,
      mutation_spec: input.mutationSpec,
      page_content_hash_at_prepare: input.pageContentHashAtPrepare,
      crawl_run_id: input.crawlRunId,
      gsc_sync_id: input.gscSyncId,
      site_model_id: input.siteModelId,
      goal_id: input.goalId,
      status: "prepared",
    })
    .select(ACTION_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to prepare action: ${error?.message ?? "unknown error"}`);
  }

  const row = data as ActionRow;
  if (input.evidenceRefs.length > 0) {
    const { error: refError } = await supabase.from("action_evidence_refs").insert(
      input.evidenceRefs.map((ref) => ({
        action_id: row.id,
        kind: ref.kind,
        record_id: ref.recordId,
        snapshot: ref.snapshot,
      })),
    );

    if (refError) {
      throw new Error(`Failed to store action evidence: ${refError.message}`);
    }
  }

  return mapAction(row, input.evidenceRefs);
}

export async function findOpenActionForDecision(input: {
  websiteId: string;
  decisionId: string;
}): Promise<ActionRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("actions")
    .select(ACTION_COLUMNS)
    .eq("website_id", input.websiteId)
    .eq("decision_id", input.decisionId)
    .eq("action_type", "update_meta_description")
    .eq("field", "meta_description")
    .in("status", [...OPEN_ACTION_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load open action: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as ActionRow;
  const refs = await loadEvidenceRefs([row.id]);
  return mapAction(row, refs.get(row.id) ?? []);
}

export async function findActionById(input: {
  websiteId: string;
  actionId: string;
}): Promise<ActionRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("actions")
    .select(ACTION_COLUMNS)
    .eq("id", input.actionId)
    .eq("website_id", input.websiteId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load action: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as ActionRow;
  const refs = await loadEvidenceRefs([row.id]);
  return mapAction(row, refs.get(row.id) ?? []);
}

export async function listVisibleActionsForWebsite(websiteId: string): Promise<ActionRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("actions")
    .select(ACTION_COLUMNS)
    .eq("website_id", websiteId)
    .in("status", ["prepared", "awaiting_approval", "approved", "executed", "blocked"])
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list actions: ${error.message}`);
  }

  const rows = (data ?? []) as ActionRow[];
  const refs = await loadEvidenceRefs(rows.map((row) => row.id));
  return rows.map((row) => mapAction(row, refs.get(row.id) ?? []));
}

export async function updateAction(input: {
  id: string;
  websiteId: string;
  expectedStatuses: ActionStatus[];
  patch: {
    proposedValue?: string | null;
    mutationSpec?: ActionMutationSpec;
    status?: ActionStatus;
    approvedByOwnerId?: string | null;
    approvedAt?: string | null;
  };
}): Promise<ActionRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("actions")
    .update({
      ...(input.patch.proposedValue !== undefined ? { proposed_value: input.patch.proposedValue } : {}),
      ...(input.patch.mutationSpec !== undefined ? { mutation_spec: input.patch.mutationSpec } : {}),
      ...(input.patch.status !== undefined ? { status: input.patch.status } : {}),
      ...(input.patch.approvedByOwnerId !== undefined
        ? { approved_by_owner_id: input.patch.approvedByOwnerId }
        : {}),
      ...(input.patch.approvedAt !== undefined ? { approved_at: input.patch.approvedAt } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("website_id", input.websiteId)
    .in("status", input.expectedStatuses)
    .select(ACTION_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update action: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as ActionRow;
  const refs = await loadEvidenceRefs([row.id]);
  return mapAction(row, refs.get(row.id) ?? []);
}

export async function countActionAttempts(actionId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("action_attempts")
    .select("id", { count: "exact", head: true })
    .eq("action_id", actionId);

  if (error) {
    throw new Error(`Failed to count action attempts: ${error.message}`);
  }

  return count ?? 0;
}

const ATTEMPT_COLUMNS =
  "id, action_id, attempt_number, idempotency_key, provider, result, error_code, artifact, created_at, finished_at";

export async function findActionAttemptByIdempotencyKey(
  idempotencyKey: string,
): Promise<ActionAttemptRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("action_attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load action attempt: ${error.message}`);
  }

  return data ? mapAttempt(data as AttemptRow) : null;
}

export async function findSuccessfulGithubExecuteAttempt(
  actionId: string,
): Promise<ActionAttemptRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("action_attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("action_id", actionId)
    .eq("provider", "github")
    .eq("result", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load successful execute attempt: ${error.message}`);
  }

  return data ? mapAttempt(data as AttemptRow) : null;
}

export async function insertActionAttempt(input: {
  actionId: string;
  attemptNumber: number;
  idempotencyKey: string;
  provider: string | null;
  result: ActionAttemptRecord["result"];
  errorCode: string | null;
  artifact?: ActionAttemptRecord["artifact"];
}): Promise<ActionAttemptRecord> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("action_attempts")
    .insert({
      action_id: input.actionId,
      attempt_number: input.attemptNumber,
      idempotency_key: input.idempotencyKey,
      provider: input.provider,
      result: input.result,
      error_code: input.errorCode,
      artifact: input.artifact ?? {},
      created_at: now,
      finished_at: now,
    })
    .select(ATTEMPT_COLUMNS)
    .maybeSingle();

  if (error?.code === "23505") {
    const existing = await findActionAttemptByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return existing;
    }
  }

  if (error || !data) {
    throw new Error(`Failed to record action attempt: ${error?.message ?? "unknown error"}`);
  }

  return mapAttempt(data as AttemptRow);
}
