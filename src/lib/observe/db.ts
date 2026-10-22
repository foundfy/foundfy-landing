import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type { QueueItemStatus } from "@/lib/crawler/types";
import type {
  ClaimTargetedObservationResult,
  FinalizeTargetedObservationResult,
  TargetedObservation,
  TargetedObservationSelectionMode,
} from "./types";

type ObservationRow = {
  id: string;
  website_id: string;
  requested_url: string;
  requested_url_key: string;
  source_crawl_run_id: string;
  source_queue_id: string;
  source_inspect_run_id: string;
  source_research_idea_id: string;
  targeted_crawl_run_id: string;
  result_page_id: string | null;
  requested_by: string;
  selection_mode: TargetedObservationSelectionMode;
  status: TargetedObservation["status"];
  failure_reason: string | null;
  started_at: string;
  completed_at: string | null;
};

const OBSERVATION_COLUMNS =
  "id, website_id, requested_url, requested_url_key, source_crawl_run_id, source_queue_id, source_inspect_run_id, source_research_idea_id, targeted_crawl_run_id, result_page_id, requested_by, selection_mode, status, failure_reason, started_at, completed_at";

export function mapTargetedObservation(row: ObservationRow): TargetedObservation {
  return {
    id: row.id,
    websiteId: row.website_id,
    requestedUrl: row.requested_url,
    requestedUrlKey: row.requested_url_key,
    sourceCrawlRunId: row.source_crawl_run_id,
    sourceQueueId: row.source_queue_id,
    sourceInspectRunId: row.source_inspect_run_id,
    sourceResearchIdeaId: row.source_research_idea_id,
    targetedCrawlRunId: row.targeted_crawl_run_id,
    resultPageId: row.result_page_id,
    requestedBy: row.requested_by,
    selectionMode: row.selection_mode,
    status: row.status,
    failureReason: row.failure_reason,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export type ObserveQueueRow = {
  id: string;
  url: string;
  status: QueueItemStatus;
  skipReason: string | null;
};

export type ObservePageRow = {
  id: string;
  requestedUrl: string;
  finalUrl: string;
  canonical: string | null;
};

export type ObserveLinkRow = {
  toUrl: string;
  anchorText: string | null;
};

export type ObserveRobotsRow = {
  statusCode: number | null;
  content: string | null;
  parsed: unknown;
};

function asClaimResult(data: Record<string, unknown>): ClaimTargetedObservationResult {
  const status = data.status;
  if (status === "stale_source") {
    return { status };
  }
  if (
    (status === "reused" || status === "already_running" || status === "claimed") &&
    typeof data.observation_id === "string" &&
    typeof data.targeted_crawl_run_id === "string" &&
    typeof data.started_at === "string"
  ) {
    if (status === "reused") {
      if (typeof data.completed_at !== "string") {
        throw new Error("Failed to claim targeted observation: invalid response");
      }
      return {
        status,
        observationId: data.observation_id,
        targetedCrawlRunId: data.targeted_crawl_run_id,
        startedAt: data.started_at,
        completedAt: data.completed_at,
      };
    }
    return {
      status,
      observationId: data.observation_id,
      targetedCrawlRunId: data.targeted_crawl_run_id,
      startedAt: data.started_at,
    };
  }
  throw new Error("Failed to claim targeted observation: invalid response");
}

function asFinalizeResult(data: Record<string, unknown>): FinalizeTargetedObservationResult {
  if (
    data.status === "analyzed" &&
    typeof data.observation_id === "string" &&
    typeof data.targeted_crawl_run_id === "string" &&
    typeof data.result_page_id === "string" &&
    typeof data.completed_at === "string"
  ) {
    return {
      status: "analyzed",
      observationId: data.observation_id,
      targetedCrawlRunId: data.targeted_crawl_run_id,
      resultPageId: data.result_page_id,
      completedAt: data.completed_at,
    };
  }
  if (
    data.status === "fetch_failed" &&
    typeof data.observation_id === "string" &&
    typeof data.targeted_crawl_run_id === "string" &&
    typeof data.failure_reason === "string" &&
    typeof data.completed_at === "string"
  ) {
    return {
      status: "fetch_failed",
      observationId: data.observation_id,
      targetedCrawlRunId: data.targeted_crawl_run_id,
      failureReason: data.failure_reason,
      completedAt: data.completed_at,
    };
  }
  throw new Error("Failed to finalize targeted observation: invalid response");
}

export async function claimTargetedObservation(input: {
  websiteId: string;
  sourceCrawlRunId: string;
  sourceQueueId: string;
  sourceInspectRunId: string;
  requestedUrlKey: string;
  requestedBy: string;
  selectionMode: TargetedObservationSelectionMode;
}): Promise<ClaimTargetedObservationResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("claim_targeted_observation", {
    p_website_id: input.websiteId,
    p_source_crawl_run_id: input.sourceCrawlRunId,
    p_source_queue_id: input.sourceQueueId,
    p_source_inspect_run_id: input.sourceInspectRunId,
    p_requested_url_key: input.requestedUrlKey,
    p_requested_by: input.requestedBy,
    p_selection_mode: input.selectionMode,
  });

  if (error || !data || typeof data !== "object") {
    throw new Error(`Failed to claim targeted observation: ${error?.message ?? "unknown error"}`);
  }

  return asClaimResult(data as Record<string, unknown>);
}

export async function finalizeTargetedObservation(input: {
  observationId: string;
  status: "analyzed" | "fetch_failed";
  resultPageId: string | null;
  failureReason: string | null;
}): Promise<FinalizeTargetedObservationResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("finalize_targeted_observation", {
    p_observation_id: input.observationId,
    p_status: input.status,
    p_result_page_id: input.resultPageId,
    p_failure_reason: input.failureReason,
  });

  if (error || !data || typeof data !== "object") {
    throw new Error(
      `Failed to finalize targeted observation: ${error?.message ?? "unknown error"}`,
    );
  }

  return asFinalizeResult(data as Record<string, unknown>);
}

export async function findTargetedObservationForWebsite(input: {
  websiteId: string;
  observationId: string;
}): Promise<TargetedObservation | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("targeted_observations")
    .select(OBSERVATION_COLUMNS)
    .eq("website_id", input.websiteId)
    .eq("id", input.observationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load targeted observation: ${error.message}`);
  }

  return data ? mapTargetedObservation(data as ObservationRow) : null;
}

export async function findRunningTargetedObservation(
  websiteId: string,
): Promise<TargetedObservation | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("targeted_observations")
    .select(OBSERVATION_COLUMNS)
    .eq("website_id", websiteId)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load running targeted observation: ${error.message}`);
  }

  return data ? mapTargetedObservation(data as ObservationRow) : null;
}

export async function findAnalyzedObservationForIdeaCrawl(input: {
  websiteId: string;
  sourceCrawlRunId: string;
  sourceResearchIdeaId: string;
}): Promise<TargetedObservation | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("targeted_observations")
    .select(OBSERVATION_COLUMNS)
    .eq("website_id", input.websiteId)
    .eq("source_crawl_run_id", input.sourceCrawlRunId)
    .eq("source_research_idea_id", input.sourceResearchIdeaId)
    .eq("status", "analyzed")
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load analyzed targeted observation: ${error.message}`);
  }

  return data ? mapTargetedObservation(data as ObservationRow) : null;
}

export async function listObserveQueueItems(crawlRunId: string): Promise<ObserveQueueRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("crawl_queue")
    .select("id, url, status, skip_reason")
    .eq("crawl_run_id", crawlRunId);

  if (error) {
    throw new Error(`Failed to list observe queue items: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    url: row.url as string,
    status: row.status as QueueItemStatus,
    skipReason: (row.skip_reason as string | null) ?? null,
  }));
}

export async function listObservePages(crawlRunId: string): Promise<ObservePageRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pages")
    .select("id, requested_url, final_url, canonical")
    .eq("crawl_run_id", crawlRunId);

  if (error) {
    throw new Error(`Failed to list observe pages: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    requestedUrl: row.requested_url as string,
    finalUrl: row.final_url as string,
    canonical: typeof row.canonical === "string" ? row.canonical : null,
  }));
}

export async function listObserveLinks(crawlRunId: string): Promise<ObserveLinkRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("links")
    .select("to_url, anchor_text")
    .eq("crawl_run_id", crawlRunId);

  if (error) {
    throw new Error(`Failed to list observe links: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    toUrl: row.to_url as string,
    anchorText: (row.anchor_text as string | null) ?? null,
  }));
}

export async function loadSourceRobotsArtifact(
  crawlRunId: string,
): Promise<ObserveRobotsRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("crawl_site_artifacts")
    .select("status_code, content, parsed")
    .eq("crawl_run_id", crawlRunId)
    .eq("artifact_type", "robots_txt")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load robots artifact: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    statusCode: (data.status_code as number | null) ?? null,
    content: (data.content as string | null) ?? null,
    parsed: data.parsed,
  };
}

export async function countTargetedQueueRows(crawlRunId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("crawl_queue")
    .select("id", { count: "exact", head: true })
    .eq("crawl_run_id", crawlRunId);

  if (error) {
    throw new Error(`Failed to count targeted queue rows: ${error.message}`);
  }

  return count ?? 0;
}
