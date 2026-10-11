import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { parseRequestLedger, serializeRequestLedger } from "./ledger";
import type {
  InitialGscSampleStatus,
  ResearchClaimOutcome,
  ResearchClaimResult,
  ResearchIdeaRecord,
  ResearchProviderEnvironment,
  ResearchProviderId,
  ResearchRequestLedgerEntry,
  ResearchRunRecord,
  ResearchRunStatus,
} from "./types";

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
  created_at: string;
};

const RUN_COLUMNS =
  "id, website_id, site_model_id, site_model_confirmed_at, requested_by, gsc_sync_id, gsc_queries_truncated, country_key, country_name, location_code, language_codes, offering_seeds, provider, provider_environment, status, request_fingerprint, request_ledger, provider_cost, failure_code, failure_message, created_at, started_at, completed_at, updated_at";

const IDEA_COLUMNS =
  "id, run_id, website_id, seed_offering, language_code, provider_task_id, keyword, compact_key, estimated_monthly_searches, provider_result_order, initial_gsc_sample_status, created_at";

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
    createdAt: row.created_at,
  };
}

export async function updateResearchRun(input: {
  id: string;
  status: ResearchRunStatus;
  requestLedger?: ResearchRequestLedgerEntry[];
  providerCost?: number | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}): Promise<ResearchRunRecord> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: now,
  };
  if (input.requestLedger) {
    patch.request_ledger = serializeRequestLedger(input.requestLedger);
  }
  if (input.providerCost !== undefined) {
    patch.provider_cost = input.providerCost;
  }
  if (input.failureCode !== undefined) {
    patch.failure_code = input.failureCode;
  }
  if (input.failureMessage !== undefined) {
    patch.failure_message = input.failureMessage;
  }
  if (input.startedAt !== undefined) {
    patch.started_at = input.startedAt;
  }
  if (input.completedAt !== undefined) {
    patch.completed_at = input.completedAt;
  }

  const { data, error } = await supabase
    .from("research_runs")
    .update(patch)
    .eq("id", input.id)
    .select(RUN_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to update research run: ${error?.message ?? "unknown error"}`);
  }

  return mapRun(data as ResearchRunRow);
}

export async function insertResearchIdeas(
  ideas: Array<Omit<ResearchIdeaRecord, "id" | "createdAt">>,
): Promise<ResearchIdeaRecord[]> {
  if (ideas.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("research_ideas")
    .insert(
      ideas.map((idea) => ({
        run_id: idea.runId,
        website_id: idea.websiteId,
        seed_offering: idea.seedOffering,
        language_code: idea.languageCode,
        provider_task_id: idea.providerTaskId,
        keyword: idea.keyword,
        compact_key: idea.compactKey,
        estimated_monthly_searches: idea.estimatedMonthlySearches,
        provider_result_order: idea.providerResultOrder,
        initial_gsc_sample_status: idea.initialGscSampleStatus,
      })),
    )
    .select(IDEA_COLUMNS);

  if (error) {
    throw new Error(`Failed to store research ideas: ${error.message}`);
  }

  return (data ?? []).map((row) => mapIdea(row as ResearchIdeaRow));
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
