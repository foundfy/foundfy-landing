import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { parseRequestLedger, serializeRequestLedger } from "./ledger";
import { ResearchExecutionSupersededError } from "./errors";
import type {
  InitialGscSampleStatus,
  ResearchClaimOutcome,
  ResearchClaimResult,
  ResearchCloseOutcome,
  ResearchFenceOutcome,
  ResearchIdeaRecord,
  ResearchProviderEnvironment,
  ResearchProviderId,
  ResearchRecoveryOutcome,
  ResearchRecoveryResult,
  ResearchRequestLedgerEntry,
  ResearchRequestStatus,
  ResearchRunRecord,
  ResearchRunStatus,
} from "./types";
import type { ResearchFilterReasonCounts } from "./filter-reasons";
import type { FencedIdeaInsert } from "./fence";

type ResearchRunRow = {
  id: string;
  website_id: string;
  site_model_id: string | null;
  site_model_confirmed_at: string;
  requested_by: string | null;
  gsc_sync_id: string | null;
  gsc_queries_truncated: boolean;
  country_key: string;
  country_name: string;
  location_code: number;
  language_codes: string[];
  offering_seeds: string[];
  provider: ResearchProviderId;
  provider_environment: ResearchProviderEnvironment;
  status: ResearchRunStatus;
  request_fingerprint: string;
  request_ledger: unknown;
  provider_cost: number | string | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  last_progress_at: string | null;
  execution_generation: number | string | null;
  closed_at: string | null;
};

type ResearchIdeaRow = {
  id: string;
  run_id: string;
  website_id: string;
  seed_offering: string;
  language_code: string;
  provider_task_id: string | null;
  keyword: string;
  compact_key: string;
  estimated_monthly_searches: number | null;
  provider_result_order: number;
  initial_gsc_sample_status: InitialGscSampleStatus;
  request_key: string | null;
  created_at: string;
};

const RUN_COLUMNS =
  "id, website_id, site_model_id, site_model_confirmed_at, requested_by, gsc_sync_id, gsc_queries_truncated, country_key, country_name, location_code, language_codes, offering_seeds, provider, provider_environment, status, request_fingerprint, request_ledger, provider_cost, failure_code, failure_message, created_at, started_at, completed_at, updated_at, last_progress_at, execution_generation, closed_at";

const IDEA_COLUMNS =
  "id, run_id, website_id, seed_offering, language_code, provider_task_id, keyword, compact_key, estimated_monthly_searches, provider_result_order, initial_gsc_sample_status, request_key, created_at";

const FENCE_OUTCOMES: ResearchFenceOutcome[] = [
  "claimed",
  "persisted",
  "finalized",
  "superseded",
  "already_attempted",
  "missing_request",
  "invalid_state",
];

function mapRun(row: ResearchRunRow): ResearchRunRecord {
  return {
    id: row.id,
    websiteId: row.website_id,
    siteModelId: row.site_model_id,
    siteModelConfirmedAt: row.site_model_confirmed_at,
    requestedBy: row.requested_by,
    gscSyncId: row.gsc_sync_id,
    gscQueriesTruncated: row.gsc_queries_truncated,
    countryKey: row.country_key,
    countryName: row.country_name,
    locationCode: row.location_code,
    languageCodes: row.language_codes,
    offeringSeeds: row.offering_seeds,
    provider: row.provider,
    providerEnvironment: row.provider_environment,
    status: row.status,
    requestFingerprint: row.request_fingerprint,
    requestLedger: parseRequestLedger(row.request_ledger),
    providerCost: row.provider_cost == null ? null : Number(row.provider_cost),
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    lastProgressAt: row.last_progress_at ?? row.updated_at,
    executionGeneration: Number(row.execution_generation ?? 1),
    closedAt: row.closed_at ?? null,
  };
}

function mapIdea(row: ResearchIdeaRow): ResearchIdeaRecord {
  return {
    id: row.id,
    runId: row.run_id,
    websiteId: row.website_id,
    seedOffering: row.seed_offering,
    languageCode: row.language_code,
    providerTaskId: row.provider_task_id,
    keyword: row.keyword,
    compactKey: row.compact_key,
    estimatedMonthlySearches: row.estimated_monthly_searches,
    providerResultOrder: row.provider_result_order,
    initialGscSampleStatus: row.initial_gsc_sample_status,
    requestKey: row.request_key ?? "",
    createdAt: row.created_at,
  };
}

function mapFenceOutcome(value: unknown): ResearchFenceOutcome {
  if (typeof value === "string" && FENCE_OUTCOMES.includes(value as ResearchFenceOutcome)) {
    return value as ResearchFenceOutcome;
  }
  throw new Error("Failed to parse research fence outcome.");
}

function mapRunFromPayload(run: unknown): ResearchRunRecord | null {
  if (!run || typeof run !== "object") {
    return null;
  }
  return mapRun(run as ResearchRunRow);
}

function rejectIfSuperseded(outcome: ResearchFenceOutcome): void {
  if (outcome === "superseded") {
    throw new ResearchExecutionSupersededError();
  }
}

async function callFenceRpc(
  name: string,
  args: Record<string, unknown>,
): Promise<{ outcome: ResearchFenceOutcome; run: ResearchRunRecord | null }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc(name, args);
  if (error || !data || typeof data !== "object") {
    throw new Error(`Failed to ${name}: ${error?.message ?? "unknown error"}`);
  }
  const payload = data as { outcome?: unknown; run?: unknown };
  const outcome = mapFenceOutcome(payload.outcome);
  rejectIfSuperseded(outcome);
  return { outcome, run: mapRunFromPayload(payload.run) };
}

export async function persistResearchRequestPlan(input: {
  runId: string;
  websiteId: string;
  executionGeneration: number;
  ledger: ResearchRequestLedgerEntry[];
}): Promise<{ outcome: ResearchFenceOutcome; run: ResearchRunRecord | null }> {
  return callFenceRpc("persist_research_request_plan", {
    p_run_id: input.runId,
    p_website_id: input.websiteId,
    p_execution_generation: input.executionGeneration,
    p_request_ledger: serializeRequestLedger(input.ledger),
  });
}

export async function claimResearchRequest(input: {
  runId: string;
  websiteId: string;
  executionGeneration: number;
  requestKey: string;
}): Promise<{ outcome: ResearchFenceOutcome; run: ResearchRunRecord | null }> {
  return callFenceRpc("claim_research_request", {
    p_run_id: input.runId,
    p_website_id: input.websiteId,
    p_execution_generation: input.executionGeneration,
    p_request_key: input.requestKey,
  });
}

export async function persistResearchRequestResult(input: {
  runId: string;
  websiteId: string;
  executionGeneration: number;
  requestKey: string;
  status: Extract<
    ResearchRequestStatus,
    "succeeded" | "zero_results" | "failed" | "timeout" | "rate_limited"
  >;
  providerTaskId: string | null;
  ideaCount: number;
  providerResultCount?: number | null;
  filterReasonCounts?: ResearchFilterReasonCounts | null;
  providerCost: number | null;
  failureCode: string | null;
  ideas: FencedIdeaInsert[];
}): Promise<{ outcome: ResearchFenceOutcome; run: ResearchRunRecord | null; ideas: ResearchIdeaRecord[] }> {
  const result = await callFenceRpc("persist_research_request_result", {
    p_run_id: input.runId,
    p_website_id: input.websiteId,
    p_execution_generation: input.executionGeneration,
    p_request_key: input.requestKey,
    p_status: input.status,
    p_provider_task_id: input.providerTaskId,
    p_idea_count: input.ideaCount,
    p_provider_result_count: input.providerResultCount ?? null,
    p_filter_reason_counts: input.filterReasonCounts ?? null,
    p_provider_cost: input.providerCost,
    p_failure_code: input.failureCode,
    p_ideas: input.ideas.map((idea) => ({
      seedOffering: idea.seedOffering,
      languageCode: idea.languageCode,
      providerTaskId: idea.providerTaskId,
      keyword: idea.keyword,
      compactKey: idea.compactKey,
      estimatedMonthlySearches: idea.estimatedMonthlySearches,
      providerResultOrder: idea.providerResultOrder,
      initialGscSampleStatus: idea.initialGscSampleStatus,
    })),
  });
  return { ...result, ideas: [] };
}

export async function skipUnattemptedResearchRequests(input: {
  runId: string;
  websiteId: string;
  executionGeneration: number;
  failureCode: string | null;
}): Promise<{ outcome: ResearchFenceOutcome; run: ResearchRunRecord | null }> {
  return callFenceRpc("skip_unattempted_research_requests", {
    p_run_id: input.runId,
    p_website_id: input.websiteId,
    p_execution_generation: input.executionGeneration,
    p_failure_code: input.failureCode,
  });
}

export async function finalizeFencedResearchRun(input: {
  runId: string;
  websiteId: string;
  executionGeneration: number;
  status: Extract<ResearchRunStatus, "completed" | "partial" | "failed" | "interrupted">;
  providerCost: number | null;
  failureCode: string | null;
  failureMessage: string | null;
  completedAt: string | null;
}): Promise<{ outcome: ResearchFenceOutcome; run: ResearchRunRecord | null }> {
  return callFenceRpc("finalize_research_run", {
    p_run_id: input.runId,
    p_website_id: input.websiteId,
    p_execution_generation: input.executionGeneration,
    p_status: input.status,
    p_provider_cost: input.providerCost,
    p_failure_code: input.failureCode,
    p_failure_message: input.failureMessage,
    p_completed_at: input.completedAt,
  });
}

export async function closeResearchRun(input: {
  runId: string;
  websiteId: string;
}): Promise<{ outcome: ResearchCloseOutcome; run: ResearchRunRecord | null }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("close_research_run", {
    p_run_id: input.runId,
    p_website_id: input.websiteId,
  });
  if (error || !data || typeof data !== "object") {
    throw new Error(`Failed to close research run: ${error?.message ?? "unknown error"}`);
  }
  const payload = data as { outcome?: unknown; run?: unknown };
  const outcome = payload.outcome;
  if (
    outcome !== "closed" &&
    outcome !== "already_closed" &&
    outcome !== "not_closeable" &&
    outcome !== "recovery_busy" &&
    outcome !== "not_found"
  ) {
    throw new Error("Failed to close research run: unexpected outcome.");
  }
  if (outcome === "not_found") {
    return { outcome, run: null };
  }
  return {
    outcome,
    run: mapRunFromPayload(payload.run),
  };
}

export async function claimResearchRun(input: {
  websiteId: string;
  requestFingerprint: string;
  reuseSinceIso: string;
  siteModelId: string | null;
  siteModelConfirmedAt: string;
  requestedBy: string | null;
  gscSyncId: string | null;
  gscQueriesTruncated: boolean;
  countryKey: string;
  countryName: string;
  locationCode: number;
  languageCodes: string[];
  offeringSeeds: string[];
  provider: ResearchProviderId;
  providerEnvironment: ResearchProviderEnvironment;
}): Promise<ResearchClaimResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("claim_research_run", {
    p_website_id: input.websiteId,
    p_request_fingerprint: input.requestFingerprint,
    p_reuse_since: input.reuseSinceIso,
    p_insert: {
      site_model_id: input.siteModelId,
      site_model_confirmed_at: input.siteModelConfirmedAt,
      requested_by: input.requestedBy,
      gsc_sync_id: input.gscSyncId,
      gsc_queries_truncated: input.gscQueriesTruncated,
      country_key: input.countryKey,
      country_name: input.countryName,
      location_code: input.locationCode,
      language_codes: input.languageCodes,
      offering_seeds: input.offeringSeeds,
      provider: input.provider,
      provider_environment: input.providerEnvironment,
    },
  });

  if (error || !data || typeof data !== "object") {
    throw new Error(`Failed to claim research run: ${error?.message ?? "unknown error"}`);
  }

  const payload = data as { outcome?: unknown; run?: unknown };
  const outcome = payload.outcome;
  if (
    outcome !== "reuse_completed" &&
    outcome !== "reuse_active" &&
    outcome !== "block_retry" &&
    outcome !== "recovery_required" &&
    outcome !== "claimed"
  ) {
    throw new Error("Failed to claim research run: unexpected outcome.");
  }

  if (!payload.run || typeof payload.run !== "object") {
    throw new Error("Failed to claim research run: missing run.");
  }

  return {
    kind: outcome as ResearchClaimOutcome,
    run: mapRun(payload.run as ResearchRunRow),
  };
}

export async function listResearchRunsForFingerprint(input: {
  websiteId: string;
  fingerprint: string;
}): Promise<ResearchRunRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("research_runs")
    .select(RUN_COLUMNS)
    .eq("website_id", input.websiteId)
    .eq("request_fingerprint", input.fingerprint)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(`Failed to load research runs for fingerprint: ${error.message}`);
  }

  return (data ?? []).map((row) => mapRun(row as ResearchRunRow));
}

export async function findResearchRunForWebsite(input: {
  runId: string;
  websiteId: string;
}): Promise<ResearchRunRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("research_runs")
    .select(RUN_COLUMNS)
    .eq("id", input.runId)
    .eq("website_id", input.websiteId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load research run: ${error.message}`);
  }

  return data ? mapRun(data as ResearchRunRow) : null;
}

export async function claimResearchRecovery(input: {
  runId: string;
  websiteId: string;
}): Promise<ResearchRecoveryResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("claim_research_recovery", {
    p_run_id: input.runId,
    p_website_id: input.websiteId,
  });

  if (error || !data || typeof data !== "object") {
    throw new Error(`Failed to claim research recovery: ${error?.message ?? "unknown error"}`);
  }

  const payload = data as { outcome?: unknown; run?: unknown };
  const outcome = payload.outcome;
  if (
    outcome !== "claimed_recovery" &&
    outcome !== "recovery_busy" &&
    outcome !== "not_recoverable" &&
    outcome !== "not_found"
  ) {
    throw new Error("Failed to claim research recovery: unexpected outcome.");
  }

  if (outcome === "not_found") {
    return { kind: outcome, run: null };
  }

  if (!payload.run || typeof payload.run !== "object") {
    throw new Error("Failed to claim research recovery: missing run.");
  }

  return {
    kind: outcome as ResearchRecoveryOutcome,
    run: mapRun(payload.run as ResearchRunRow),
  };
}

export async function listResearchIdeasForRun(runId: string): Promise<ResearchIdeaRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("research_ideas")
    .select(IDEA_COLUMNS)
    .eq("run_id", runId)
    .order("provider_result_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load research ideas: ${error.message}`);
  }

  return (data ?? []).map((row) => mapIdea(row as ResearchIdeaRow));
}

export async function findResearchIdeaForWebsite(input: {
  ideaId: string;
  websiteId: string;
}): Promise<ResearchIdeaRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("research_ideas")
    .select(IDEA_COLUMNS)
    .eq("id", input.ideaId)
    .eq("website_id", input.websiteId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load research idea: ${error.message}`);
  }

  return data ? mapIdea(data as ResearchIdeaRow) : null;
}

export async function findLatestCompatibleResearchRun(input: {
  websiteId: string;
  environment: ResearchProviderEnvironment;
}): Promise<ResearchRunRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("research_runs")
    .select(RUN_COLUMNS)
    .eq("website_id", input.websiteId)
    .eq("provider_environment", input.environment)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load compatible research run: ${error.message}`);
  }

  return data ? mapRun(data as ResearchRunRow) : null;
}
