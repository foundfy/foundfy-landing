import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { SEARCH_ANALYTICS_SOURCE } from "./config";
import type {
  GscSearchEvidenceRecord,
  GscSearchEvidenceType,
  GscSearchSyncRecord,
} from "./types";

type SyncRow = {
  id: string;
  website_id: string;
  property_connection_id: string;
  period_start: string;
  period_end: string;
  status: GscSearchSyncRecord["status"];
  source: "google_search_console_search_analytics";
  started_at: string;
  completed_at: string | null;
  error_code: string | null;
  site_row_count: number;
  page_row_count: number;
  query_row_count: number;
  query_page_row_count: number;
  pages_truncated: boolean;
  queries_truncated: boolean;
  query_pages_truncated: boolean;
};

type EvidenceRow = {
  id: string;
  sync_id: string;
  website_id: string;
  property_connection_id: string;
  evidence_type: GscSearchEvidenceType;
  page_url: string | null;
  page_id: string | null;
  query_text: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  period_start: string;
  period_end: string;
  retrieved_at: string;
};

const SYNC_COLUMNS =
  "id, website_id, property_connection_id, period_start, period_end, status, source, started_at, completed_at, error_code, site_row_count, page_row_count, query_row_count, query_page_row_count, pages_truncated, queries_truncated, query_pages_truncated";

const EVIDENCE_COLUMNS =
  "id, sync_id, website_id, property_connection_id, evidence_type, page_url, page_id, query_text, clicks, impressions, ctr, position, period_start, period_end, retrieved_at";

function mapSync(row: SyncRow): GscSearchSyncRecord {
  return {
    id: row.id,
    websiteId: row.website_id,
    propertyConnectionId: row.property_connection_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    source: row.source,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    errorCode: row.error_code,
    siteRowCount: row.site_row_count,
    pageRowCount: row.page_row_count,
    queryRowCount: row.query_row_count,
    queryPageRowCount: row.query_page_row_count,
    pagesTruncated: row.pages_truncated,
    queriesTruncated: row.queries_truncated,
    queryPagesTruncated: row.query_pages_truncated,
  };
}

function mapEvidence(row: EvidenceRow): GscSearchEvidenceRecord {
  return {
    id: row.id,
    syncId: row.sync_id,
    websiteId: row.website_id,
    propertyConnectionId: row.property_connection_id,
    evidenceType: row.evidence_type,
    pageUrl: row.page_url,
    pageId: row.page_id,
    queryText: row.query_text,
    clicks: Number(row.clicks),
    impressions: Number(row.impressions),
    ctr: Number(row.ctr),
    position: Number(row.position),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    retrievedAt: row.retrieved_at,
  };
}

export async function insertRunningSearchSync(input: {
  websiteId: string;
  propertyConnectionId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<GscSearchSyncRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("gsc_search_syncs")
    .insert({
      website_id: input.websiteId,
      property_connection_id: input.propertyConnectionId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      status: "running",
      source: SEARCH_ANALYTICS_SOURCE,
    })
    .select(SYNC_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to start Search Analytics sync: ${error?.message ?? "unknown error"}`);
  }

  return mapSync(data as SyncRow);
}

export async function completeSearchSync(input: {
  id: string;
  siteRowCount: number;
  pageRowCount: number;
  queryRowCount: number;
  queryPageRowCount: number;
  pagesTruncated: boolean;
  queriesTruncated: boolean;
  queryPagesTruncated: boolean;
}): Promise<GscSearchSyncRecord> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("gsc_search_syncs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      error_code: null,
      site_row_count: input.siteRowCount,
      page_row_count: input.pageRowCount,
      query_row_count: input.queryRowCount,
      query_page_row_count: input.queryPageRowCount,
      pages_truncated: input.pagesTruncated,
      queries_truncated: input.queriesTruncated,
      query_pages_truncated: input.queryPagesTruncated,
    })
    .eq("id", input.id)
    .eq("status", "running")
    .select(SYNC_COLUMNS)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Failed to complete Search Analytics sync: ${error?.message ?? "unknown error"}`);
  }

  return mapSync(data as SyncRow);
}

export async function failSearchSync(input: {
  id: string;
  errorCode: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("gsc_search_syncs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_code: input.errorCode,
    })
    .eq("id", input.id)
    .eq("status", "running");

  if (error) {
    throw new Error(`Failed to mark Search Analytics sync failed: ${error.message}`);
  }
}

export type SearchEvidenceInsert = {
  syncId: string;
  websiteId: string;
  propertyConnectionId: string;
  evidenceType: GscSearchEvidenceType;
  pageUrl: string | null;
  pageId: string | null;
  queryText: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  periodStart: string;
  periodEnd: string;
  retrievedAt: string;
};

export async function insertSearchEvidence(rows: SearchEvidenceInsert[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("gsc_search_evidence").insert(
    rows.map((row) => ({
      sync_id: row.syncId,
      website_id: row.websiteId,
      property_connection_id: row.propertyConnectionId,
      evidence_type: row.evidenceType,
      page_url: row.pageUrl,
      page_id: row.pageId,
      query_text: row.queryText,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      period_start: row.periodStart,
      period_end: row.periodEnd,
      retrieved_at: row.retrievedAt,
    })),
  );

  if (error) {
    throw new Error(`Failed to store Search Analytics evidence: ${error.message}`);
  }
}

export async function deleteEvidenceForSync(syncId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("gsc_search_evidence").delete().eq("sync_id", syncId);
  if (error) {
    throw new Error(`Failed to roll back Search Analytics evidence: ${error.message}`);
  }
}

export async function findLatestCompletedSearchSync(
  websiteId: string,
  propertyConnectionId: string,
): Promise<GscSearchSyncRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("gsc_search_syncs")
    .select(SYNC_COLUMNS)
    .eq("website_id", websiteId)
    .eq("property_connection_id", propertyConnectionId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Search Analytics sync: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapSync(data as SyncRow);
}

export async function listEvidenceForSync(syncId: string): Promise<GscSearchEvidenceRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("gsc_search_evidence")
    .select(EVIDENCE_COLUMNS)
    .eq("sync_id", syncId)
    .order("impressions", { ascending: false });

  if (error) {
    throw new Error(`Failed to load Search Analytics evidence: ${error.message}`);
  }

  return (data ?? []).map((row) => mapEvidence(row as EvidenceRow));
}

export async function deleteSearchAnalyticsForWebsite(websiteId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error: evidenceError } = await supabase
    .from("gsc_search_evidence")
    .delete()
    .eq("website_id", websiteId);

  if (evidenceError) {
    throw new Error(`Failed to delete Search Analytics evidence: ${evidenceError.message}`);
  }

  const { error: syncError } = await supabase
    .from("gsc_search_syncs")
    .delete()
    .eq("website_id", websiteId);

  if (syncError) {
    throw new Error(`Failed to delete Search Analytics syncs: ${syncError.message}`);
  }
}
