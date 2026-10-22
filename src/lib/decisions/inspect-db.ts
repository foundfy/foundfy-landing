import { isNonSiteSamplePurpose } from "@/lib/crawler/purpose";
import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { listDecisionsForRun } from "./db";
import { INSPECT_RELATED_DEMAND_ENGINE } from "./inspect-display";
import type { InspectPageEvidence } from "./inspect-match";
import {
  asResearchInspectDecisionRecord,
  type DecisionEvidenceRef,
  type DecisionRunRecord,
  type ResearchInspectDecisionRecord,
  type ResearchInspectState,
} from "./types";

type RunRow = {
  id: string;
  website_id: string;
  site_model_id: string;
  crawl_run_id: string;
  gsc_search_sync_id: string | null;
  engine_version: string;
  status: DecisionRunRecord["status"];
  goal_id: string | null;
  goal_snapshot: Record<string, unknown>;
  gsc_truncated: boolean;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
  research_idea_id: string | null;
  targeted_observation_id: string | null;
};

const RUN_COLUMNS =
  "id, website_id, site_model_id, crawl_run_id, gsc_search_sync_id, engine_version, status, goal_id, goal_snapshot, gsc_truncated, error_code, created_at, completed_at, research_idea_id, targeted_observation_id";

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
    researchIdeaId: row.research_idea_id,
    targetedObservationId: row.targeted_observation_id,
  };
}

export type InspectCrawlRecord = {
  id: string;
  pagesCrawled: number;
  pagesDiscovered: number;
};

export async function findInspectCrawl(crawlRunId: string): Promise<InspectCrawlRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("crawl_runs")
    .select("id, pages_crawled, pages_discovered, purpose")
    .eq("id", crawlRunId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load crawl for inspection: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  if (isNonSiteSamplePurpose((data as { purpose?: string | null }).purpose)) {
    return null;
  }

  return {
    id: data.id,
    pagesCrawled: data.pages_crawled,
    pagesDiscovered: data.pages_discovered,
  };
}

export async function listInspectPagesForCrawl(crawlRunId: string): Promise<InspectPageEvidence[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pages")
    .select(
      "id, requested_url, final_url, title, h1, meta_description, main_excerpt, html_lang, url_locale, canonical",
    )
    .eq("crawl_run_id", crawlRunId)
    .order("fetched_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load pages for inspection: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    requestedUrl: row.requested_url,
    finalUrl: row.final_url,
    title: row.title ?? null,
    h1: Array.isArray(row.h1) ? row.h1.filter((item): item is string => typeof item === "string") : [],
    metaDescription: row.meta_description ?? null,
    excerpt: row.main_excerpt ?? null,
    htmlLang: row.html_lang ?? null,
    urlLocale: row.url_locale ?? null,
    canonical: row.canonical ?? null,
  }));
}

export async function findInspectRunById(input: {
  websiteId: string;
  runId: string;
}): Promise<DecisionRunRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("decision_runs")
    .select(RUN_COLUMNS)
    .eq("website_id", input.websiteId)
    .eq("id", input.runId)
    .eq("engine_version", INSPECT_RELATED_DEMAND_ENGINE)
    .eq("status", "completed")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load inspection run: ${error.message}`);
  }

  return data ? mapRun(data as RunRow) : null;
}

export async function findLatestT0InspectRunForIdeaAndCrawl(input: {
  websiteId: string;
  researchIdeaId: string;
  crawlRunId: string;
}): Promise<DecisionRunRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("decision_runs")
    .select(RUN_COLUMNS)
    .eq("website_id", input.websiteId)
    .eq("research_idea_id", input.researchIdeaId)
    .eq("crawl_run_id", input.crawlRunId)
    .eq("engine_version", INSPECT_RELATED_DEMAND_ENGINE)
    .eq("status", "completed")
    .is("targeted_observation_id", null)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load related-demand inspection: ${error.message}`);
  }

  return data ? mapRun(data as RunRow) : null;
}

export async function listInspectPageById(pageId: string): Promise<InspectPageEvidence | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pages")
    .select(
      "id, requested_url, final_url, title, h1, meta_description, main_excerpt, html_lang, url_locale, canonical",
    )
    .eq("id", pageId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load targeted observation page: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    requestedUrl: data.requested_url,
    finalUrl: data.final_url,
    title: data.title ?? null,
    h1: Array.isArray(data.h1) ? data.h1.filter((item): item is string => typeof item === "string") : [],
    metaDescription: data.meta_description ?? null,
    excerpt: data.main_excerpt ?? null,
    htmlLang: data.html_lang ?? null,
    urlLocale: data.url_locale ?? null,
    canonical: data.canonical ?? null,
  };
}

export async function findCompletedInspectRun(input: {
  websiteId: string;
  researchIdeaId: string;
  crawlRunId: string;
  gscSearchSyncId: string | null;
}): Promise<DecisionRunRecord | null> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("decision_runs")
    .select(RUN_COLUMNS)
    .eq("website_id", input.websiteId)
    .eq("research_idea_id", input.researchIdeaId)
    .eq("crawl_run_id", input.crawlRunId)
    .eq("engine_version", INSPECT_RELATED_DEMAND_ENGINE)
    .eq("status", "completed")
    .is("targeted_observation_id", null);

  query =
    input.gscSearchSyncId == null
      ? query.is("gsc_search_sync_id", null)
      : query.eq("gsc_search_sync_id", input.gscSearchSyncId);

  const { data, error } = await query
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load related-demand inspection: ${error.message}`);
  }

  return data ? mapRun(data as RunRow) : null;
}

export async function listCompletedInspectRunsForIdeas(input: {
  websiteId: string;
  ideaIds: string[];
}): Promise<DecisionRunRecord[]> {
  if (input.ideaIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("decision_runs")
    .select(RUN_COLUMNS)
    .eq("website_id", input.websiteId)
    .eq("engine_version", INSPECT_RELATED_DEMAND_ENGINE)
    .eq("status", "completed")
    .in("research_idea_id", input.ideaIds)
    .order("completed_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to load related-demand inspections: ${error.message}`);
  }

  const latestByIdea = new Map<string, DecisionRunRecord>();
  for (const row of (data ?? []) as RunRow[]) {
    const run = mapRun(row);
    const ideaId = run.researchIdeaId;
    if (!ideaId || latestByIdea.has(ideaId)) {
      continue;
    }
    latestByIdea.set(ideaId, run);
  }

  return [...latestByIdea.values()];
}

export type PersistResearchInspectDecisionInput = {
  researchIdeaId: string;
  siteModelId: string;
  crawlRunId: string;
  gscSearchSyncId: string | null;
  title: string;
  explanation: string;
  pageUrl: string | null;
  pageId: string | null;
  inspectionState: ResearchInspectState;
  gscTruncated: boolean;
  evidenceRefs: DecisionEvidenceRef[];
};

export type PersistResearchInspectDecisionResult = {
  reused: boolean;
  runId: string;
  decisionId: string;
};

export async function persistResearchInspectDecision(
  input: PersistResearchInspectDecisionInput,
): Promise<PersistResearchInspectDecisionResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("persist_research_inspect_decision", {
    p_research_idea_id: input.researchIdeaId,
    p_site_model_id: input.siteModelId,
    p_crawl_run_id: input.crawlRunId,
    p_gsc_search_sync_id: input.gscSearchSyncId,
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
  });

  if (error || !data || typeof data !== "object") {
    throw new Error(
      `Failed to persist related-demand inspection: ${error?.message ?? "unknown error"}`,
    );
  }

  const payload = data as { reused?: unknown; run_id?: unknown; decision_id?: unknown };
  if (typeof payload.run_id !== "string" || typeof payload.decision_id !== "string") {
    throw new Error("Failed to persist related-demand inspection: invalid response");
  }

  return {
    reused: payload.reused === true,
    runId: payload.run_id,
    decisionId: payload.decision_id,
  };
}

export async function loadInspectDecision(runId: string): Promise<ResearchInspectDecisionRecord | null> {
  const decisions = await listDecisionsForRun(runId);
  const decision = decisions[0];
  return decision ? asResearchInspectDecisionRecord(decision) : null;
}
