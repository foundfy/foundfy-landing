import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type { FetchedPageRef } from "./map-fetched-page";
import type { AnalysisRequestRecord, AnalysisRequestStatus } from "./types";

type AnalysisRequestRow = {
  id: string;
  website_id: string;
  decision_id: string | null;
  decision_run_id: string | null;
  gsc_sync_id: string | null;
  requested_url: string;
  requested_url_key: string;
  requested_by: string;
  requested_at: string;
  crawl_run_id: string | null;
  result_page_id: string | null;
  status: AnalysisRequestStatus;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  "id, website_id, decision_id, decision_run_id, gsc_sync_id, requested_url, requested_url_key, requested_by, requested_at, crawl_run_id, result_page_id, status, failure_reason, created_at, updated_at";

export const ACTIVE_ANALYSIS_STATUSES: AnalysisRequestStatus[] = ["requested", "running"];

function mapRow(row: AnalysisRequestRow): AnalysisRequestRecord {
  return {
    id: row.id,
    websiteId: row.website_id,
    decisionId: row.decision_id,
    decisionRunId: row.decision_run_id,
    gscSyncId: row.gsc_sync_id,
    requestedUrl: row.requested_url,
    requestedUrlKey: row.requested_url_key,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    crawlRunId: row.crawl_run_id,
    resultPageId: row.result_page_id,
    status: row.status,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAnalysisRequestView(record: AnalysisRequestRecord) {
  return {
    id: record.id,
    decisionId: record.decisionId,
    requestedUrl: record.requestedUrl,
    crawlRunId: record.crawlRunId,
    resultPageId: record.resultPageId,
    status: record.status,
    failureReason: record.failureReason,
    requestedAt: record.requestedAt,
  };
}

export async function insertAnalysisRequest(input: {
  websiteId: string;
  decisionId: string | null;
  decisionRunId: string | null;
  gscSyncId: string | null;
  requestedUrl: string;
  requestedUrlKey: string;
  requestedBy: string;
  crawlRunId: string | null;
  resultPageId?: string | null;
  status: AnalysisRequestStatus;
  failureReason?: string | null;
}): Promise<AnalysisRequestRecord> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("analysis_requests")
    .insert({
      website_id: input.websiteId,
      decision_id: input.decisionId,
      decision_run_id: input.decisionRunId,
      gsc_sync_id: input.gscSyncId,
      requested_url: input.requestedUrl,
      requested_url_key: input.requestedUrlKey,
      requested_by: input.requestedBy,
      requested_at: now,
      crawl_run_id: input.crawlRunId,
      result_page_id: input.resultPageId ?? null,
      status: input.status,
      failure_reason: input.failureReason ?? null,
      updated_at: now,
    })
    .select(COLUMNS)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to store analysis request: ${error?.message ?? "unknown error"}`);
  }

  return mapRow(data as AnalysisRequestRow);
}

export async function findAnalysisRequestById(
  id: string,
): Promise<AnalysisRequestRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("analysis_requests")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load analysis request: ${error.message}`);
  }

  return data ? mapRow(data as AnalysisRequestRow) : null;
}

export async function updateActiveAnalysisRequest(
  id: string,
  patch: {
    status?: AnalysisRequestStatus;
    crawlRunId?: string | null;
    resultPageId?: string | null;
    failureReason?: string | null;
  },
): Promise<AnalysisRequestRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("analysis_requests")
    .update({
      ...(patch.status != null ? { status: patch.status } : {}),
      ...(patch.crawlRunId !== undefined ? { crawl_run_id: patch.crawlRunId } : {}),
      ...(patch.resultPageId !== undefined ? { result_page_id: patch.resultPageId } : {}),
      ...(patch.failureReason !== undefined ? { failure_reason: patch.failureReason } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ACTIVE_ANALYSIS_STATUSES)
    .select(COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to settle analysis request: ${error.message}`);
  }

  return data ? mapRow(data as AnalysisRequestRow) : null;
}

export async function findActiveAnalysisRequest(input: {
  websiteId: string;
  requestedUrlKey: string;
}): Promise<AnalysisRequestRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("analysis_requests")
    .select(COLUMNS)
    .eq("website_id", input.websiteId)
    .eq("requested_url_key", input.requestedUrlKey)
    .in("status", ACTIVE_ANALYSIS_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load active analysis request: ${error.message}`);
  }

  return data ? mapRow(data as AnalysisRequestRow) : null;
}

export async function listAnalysisRequestsForWebsite(
  websiteId: string,
): Promise<AnalysisRequestRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("analysis_requests")
    .select(COLUMNS)
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list analysis requests: ${error.message}`);
  }

  return (data ?? []).map((row) => mapRow(row as AnalysisRequestRow));
}

export async function listOpenAnalysisRequestsForCrawlRun(
  crawlRunId: string,
): Promise<AnalysisRequestRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("analysis_requests")
    .select(COLUMNS)
    .eq("crawl_run_id", crawlRunId)
    .in("status", ACTIVE_ANALYSIS_STATUSES);

  if (error) {
    throw new Error(`Failed to list crawl analysis requests: ${error.message}`);
  }

  return (data ?? []).map((row) => mapRow(row as AnalysisRequestRow));
}

export async function listFetchedPagesForCrawlRun(crawlRunId: string): Promise<FetchedPageRef[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pages")
    .select("id, requested_url, final_url")
    .eq("crawl_run_id", crawlRunId);

  if (error) {
    throw new Error(`Failed to load fetched pages for analysis request: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    requestedUrl: row.requested_url as string,
    finalUrl: row.final_url as string,
  }));
}

export async function disconnectAnalysisRequestsForWebsite(websiteId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error: blockError } = await supabase
    .from("analysis_requests")
    .update({
      status: "blocked",
      failure_reason: "google_disconnected",
      decision_id: null,
      decision_run_id: null,
      gsc_sync_id: null,
      updated_at: now,
    })
    .eq("website_id", websiteId)
    .in("status", ACTIVE_ANALYSIS_STATUSES);

  if (blockError) {
    throw new Error(`Failed to block pending analysis requests: ${blockError.message}`);
  }

  const { error: scrubError } = await supabase
    .from("analysis_requests")
    .update({
      decision_id: null,
      decision_run_id: null,
      gsc_sync_id: null,
      updated_at: now,
    })
    .eq("website_id", websiteId);

  if (scrubError) {
    throw new Error(`Failed to disconnect analysis request provenance: ${scrubError.message}`);
  }
}
