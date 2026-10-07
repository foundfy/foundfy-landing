import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type { DecisionEvidenceRef } from "@/lib/decisions/types";
import { OPEN_ACTION_STATUSES } from "./config";
import type {
  ActionAttemptRecord,
  ActionEvidenceRef,
  ActionMutationSpec,
  ActionRecord,
  ActionStatus,
  ActionVerificationEvidenceSnapshot,
  ActionVerificationRecord,
  ActionLearningRecord,
} from "./types";

type ActionRow = {
  id: string;
  website_id: string;
  decision_id: string | null;
  decision_run_id: string | null;
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
  gsc_sync_id: string | null;
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
  title: string | null;
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
    .select("id, crawl_run_id, requested_url, final_url, title, meta_description, content_hash")
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
    title: data.title,
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
  actionType: ActionRecord["actionType"];
  targetPageId: string;
  targetPageUrl: string;
  field: ActionRecord["field"];
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
      action_type: input.actionType,
      target_page_id: input.targetPageId,
      target_page_url: input.targetPageUrl,
      field: input.field,
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

export async function findSuccessfulExecuteAttempt(
  actionId: string,
): Promise<ActionAttemptRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("action_attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("action_id", actionId)
    .eq("result", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load successful execute attempt: ${error.message}`);
  }

  return data ? mapAttempt(data as AttemptRow) : null;
}

export type VerificationCrawlSnapshot = {
  id: string;
  websiteId: string;
  status: string;
  pagesCrawled: number;
  completedAt: string | null;
  createdAt: string;
};

export async function findLatestCompletedCrawlAfter(input: {
  websiteId: string;
  afterIso: string;
}): Promise<VerificationCrawlSnapshot | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("crawl_runs")
    .select("id, website_id, status, pages_crawled, completed_at, created_at")
    .eq("website_id", input.websiteId)
    .eq("status", "completed")
    .gt("pages_crawled", 0)
    .gt("completed_at", input.afterIso)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load post-execution crawl: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    websiteId: data.website_id,
    status: data.status,
    pagesCrawled: data.pages_crawled,
    completedAt: data.completed_at,
    createdAt: data.created_at,
  };
}

export type VerificationPageRow = {
  id: string;
  crawlRunId: string;
  requestedUrl: string;
  finalUrl: string;
  statusCode: number | null;
  metaDescription: string | null;
  contentHash: string | null;
};

export async function listPagesForCrawlRun(crawlRunId: string): Promise<VerificationPageRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pages")
    .select("id, crawl_run_id, requested_url, final_url, status_code, meta_description, content_hash")
    .eq("crawl_run_id", crawlRunId);

  if (error) {
    throw new Error(`Failed to load crawl pages for verification: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    crawlRunId: row.crawl_run_id,
    requestedUrl: row.requested_url,
    finalUrl: row.final_url,
    statusCode: row.status_code,
    metaDescription: row.meta_description,
    contentHash: row.content_hash,
  }));
}

export async function findActiveMissingMetaObservation(input: {
  crawlRunId: string;
  pageId: string;
}): Promise<ActionObservationSnapshot | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("observations")
    .select("id, page_id, rule_key, status, evidence")
    .eq("crawl_run_id", input.crawlRunId)
    .eq("page_id", input.pageId)
    .eq("rule_key", "page_fundamentals.missing_meta_description")
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load missing-meta observation for verification: ${error.message}`);
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

type VerificationRow = {
  id: string;
  action_id: string;
  website_id: string;
  execution_attempt_id: string;
  crawl_run_id: string;
  target_page_id: string | null;
  verification_type: ActionVerificationRecord["verificationType"];
  status: ActionVerificationRecord["status"];
  expected_value: string | null;
  observed_value: string | null;
  evidence_snapshot: ActionVerificationEvidenceSnapshot;
  verified_at: string | null;
  created_at: string;
};

const VERIFICATION_COLUMNS =
  "id, action_id, website_id, execution_attempt_id, crawl_run_id, target_page_id, verification_type, status, expected_value, observed_value, evidence_snapshot, verified_at, created_at";

function mapVerification(row: VerificationRow): ActionVerificationRecord {
  return {
    id: row.id,
    actionId: row.action_id,
    websiteId: row.website_id,
    executionAttemptId: row.execution_attempt_id,
    crawlRunId: row.crawl_run_id,
    targetPageId: row.target_page_id,
    verificationType: row.verification_type,
    status: row.status,
    expectedValue: row.expected_value,
    observedValue: row.observed_value,
    evidenceSnapshot: row.evidence_snapshot ?? {},
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  };
}

export async function findVerificationByIdempotency(input: {
  actionId: string;
  executionAttemptId: string;
  crawlRunId: string;
}): Promise<ActionVerificationRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("action_verifications")
    .select(VERIFICATION_COLUMNS)
    .eq("action_id", input.actionId)
    .eq("execution_attempt_id", input.executionAttemptId)
    .eq("crawl_run_id", input.crawlRunId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load action verification: ${error.message}`);
  }

  return data ? mapVerification(data as VerificationRow) : null;
}

export async function findLatestVerificationForAction(
  actionId: string,
): Promise<ActionVerificationRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("action_verifications")
    .select(VERIFICATION_COLUMNS)
    .eq("action_id", actionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load latest action verification: ${error.message}`);
  }

  return data ? mapVerification(data as VerificationRow) : null;
}

export async function insertActionVerification(input: {
  actionId: string;
  websiteId: string;
  executionAttemptId: string;
  crawlRunId: string;
  targetPageId: string | null;
  status: ActionVerificationRecord["status"];
  expectedValue: string | null;
  observedValue: string | null;
  evidenceSnapshot: ActionVerificationEvidenceSnapshot;
}): Promise<ActionVerificationRecord> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("action_verifications")
    .insert({
      action_id: input.actionId,
      website_id: input.websiteId,
      execution_attempt_id: input.executionAttemptId,
      crawl_run_id: input.crawlRunId,
      target_page_id: input.targetPageId,
      verification_type: "update_meta_description",
      status: input.status,
      expected_value: input.expectedValue,
      observed_value: input.observedValue,
      evidence_snapshot: input.evidenceSnapshot,
      verified_at: input.status === "verified" ? now : null,
      created_at: now,
    })
    .select(VERIFICATION_COLUMNS)
    .maybeSingle();

  if (error?.code === "23505") {
    const existing = await findVerificationByIdempotency({
      actionId: input.actionId,
      executionAttemptId: input.executionAttemptId,
      crawlRunId: input.crawlRunId,
    });
    if (existing) {
      return existing;
    }
  }

  if (error || !data) {
    throw new Error(`Failed to record action verification: ${error?.message ?? "unknown error"}`);
  }

  return mapVerification(data as VerificationRow);
}

type LearningRow = {
  id: string;
  action_id: string;
  verification_id: string;
  website_id: string;
  page_url: string;
  page_comparison_key: string;
  baseline_sync_id: string | null;
  comparison_sync_id: string;
  baseline_period_start: string;
  baseline_period_end: string;
  comparison_period_start: string;
  comparison_period_end: string;
  baseline_appearances: number;
  baseline_visits: number;
  baseline_ctr: number | null;
  baseline_position: number | null;
  comparison_appearances: number;
  comparison_visits: number;
  comparison_ctr: number | null;
  comparison_position: number | null;
  baseline_pages_truncated: boolean;
  comparison_pages_truncated: boolean;
  outcome_state: ActionLearningRecord["outcomeState"];
  insufficient_reason: string | null;
  calculation_version: "learn_v0";
  created_at: string;
};

const LEARNING_COLUMNS =
  "id, action_id, verification_id, website_id, page_url, page_comparison_key, baseline_sync_id, comparison_sync_id, baseline_period_start, baseline_period_end, comparison_period_start, comparison_period_end, baseline_appearances, baseline_visits, baseline_ctr, baseline_position, comparison_appearances, comparison_visits, comparison_ctr, comparison_position, baseline_pages_truncated, comparison_pages_truncated, outcome_state, insufficient_reason, calculation_version, created_at";

function mapLearning(row: LearningRow): ActionLearningRecord {
  return {
    id: row.id,
    actionId: row.action_id,
    verificationId: row.verification_id,
    websiteId: row.website_id,
    pageUrl: row.page_url,
    pageComparisonKey: row.page_comparison_key,
    baselineSyncId: row.baseline_sync_id,
    comparisonSyncId: row.comparison_sync_id,
    baselinePeriodStart: row.baseline_period_start,
    baselinePeriodEnd: row.baseline_period_end,
    comparisonPeriodStart: row.comparison_period_start,
    comparisonPeriodEnd: row.comparison_period_end,
    baselineAppearances: Number(row.baseline_appearances),
    baselineVisits: Number(row.baseline_visits),
    baselineCtr: row.baseline_ctr == null ? null : Number(row.baseline_ctr),
    baselinePosition: row.baseline_position == null ? null : Number(row.baseline_position),
    comparisonAppearances: Number(row.comparison_appearances),
    comparisonVisits: Number(row.comparison_visits),
    comparisonCtr: row.comparison_ctr == null ? null : Number(row.comparison_ctr),
    comparisonPosition: row.comparison_position == null ? null : Number(row.comparison_position),
    baselinePagesTruncated: row.baseline_pages_truncated,
    comparisonPagesTruncated: row.comparison_pages_truncated,
    outcomeState: row.outcome_state,
    insufficientReason: row.insufficient_reason,
    calculationVersion: row.calculation_version,
    createdAt: row.created_at,
  };
}

export async function findLearningByIdempotency(input: {
  actionId: string;
  verificationId: string;
  comparisonSyncId: string;
}): Promise<ActionLearningRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("action_learning_snapshots")
    .select(LEARNING_COLUMNS)
    .eq("action_id", input.actionId)
    .eq("verification_id", input.verificationId)
    .eq("comparison_sync_id", input.comparisonSyncId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load action learning snapshot: ${error.message}`);
  }

  return data ? mapLearning(data as LearningRow) : null;
}

export async function insertActionLearningSnapshot(
  input: Omit<ActionLearningRecord, "id" | "createdAt">,
): Promise<ActionLearningRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("action_learning_snapshots")
    .insert({
      action_id: input.actionId,
      verification_id: input.verificationId,
      website_id: input.websiteId,
      page_url: input.pageUrl,
      page_comparison_key: input.pageComparisonKey,
      baseline_sync_id: input.baselineSyncId,
      comparison_sync_id: input.comparisonSyncId,
      baseline_period_start: input.baselinePeriodStart,
      baseline_period_end: input.baselinePeriodEnd,
      comparison_period_start: input.comparisonPeriodStart,
      comparison_period_end: input.comparisonPeriodEnd,
      baseline_appearances: input.baselineAppearances,
      baseline_visits: input.baselineVisits,
      baseline_ctr: input.baselineCtr,
      baseline_position: input.baselinePosition,
      comparison_appearances: input.comparisonAppearances,
      comparison_visits: input.comparisonVisits,
      comparison_ctr: input.comparisonCtr,
      comparison_position: input.comparisonPosition,
      baseline_pages_truncated: input.baselinePagesTruncated,
      comparison_pages_truncated: input.comparisonPagesTruncated,
      outcome_state: input.outcomeState,
      insufficient_reason: input.insufficientReason,
      calculation_version: input.calculationVersion,
    })
    .select(LEARNING_COLUMNS)
    .maybeSingle();

  if (error?.code === "23505") {
    const existing = await findLearningByIdempotency({
      actionId: input.actionId,
      verificationId: input.verificationId,
      comparisonSyncId: input.comparisonSyncId,
    });
    if (existing) {
      return existing;
    }
  }

  if (error || !data) {
    throw new Error(`Failed to record action learning snapshot: ${error?.message ?? "unknown error"}`);
  }

  return mapLearning(data as LearningRow);
}

export async function deleteOpenActionsForWebsite(websiteId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("actions")
    .delete()
    .eq("website_id", websiteId)
    .in("status", [...OPEN_ACTION_STATUSES]);

  if (error) {
    throw new Error(`Failed to delete open actions: ${error.message}`);
  }
}

export async function deleteActionLearningSnapshotsForWebsite(websiteId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("action_learning_snapshots").delete().eq("website_id", websiteId);
  if (error) {
    throw new Error(`Failed to delete action learning snapshots: ${error.message}`);
  }
}

export async function scrubGoogleMetricsFromActionEvidence(websiteId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("actions")
    .select("id")
    .eq("website_id", websiteId);

  if (error) {
    throw new Error(`Failed to load actions for Google-metric cleanup: ${error.message}`);
  }

  const actionIds = (data ?? []).map((row) => row.id as string);
  if (actionIds.length === 0) {
    return;
  }

  const { error: refError } = await supabase
    .from("action_evidence_refs")
    .update({ snapshot: {} })
    .in("action_id", actionIds)
    .in("kind", ["gsc_evidence", "gsc_sync"]);

  if (refError) {
    throw new Error(`Failed to remove Google metrics from action evidence: ${refError.message}`);
  }
}
