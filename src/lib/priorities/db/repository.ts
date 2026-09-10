import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { getCrawlRunSummary } from "@/lib/crawler/db/repository";
import {
  generateObservationsForCrawlRun,
  listObservations,
} from "@/lib/observations/db/repository";
import type { StoredObservation } from "@/lib/observations/types";
import { buildPriorityContext, generatePriorityDrafts } from "../engine";
import type { PriorityDraft, StoredPriority } from "../types";

type PriorityRow = {
  id: string;
  crawl_run_id: string;
  website_id: string;
  observation_id: string;
  rule_key: string;
  subject_key: string;
  priority_score: number;
  priority_level: string;
  impact_score: number;
  reach_score: number;
  confidence_score: number;
  why_it_matters: string;
  recommended_action: string;
  verification: string | null;
  explainability: Record<string, unknown>;
  rank: number;
  status: string;
  created_at: string;
  updated_at: string;
};

function mapPriorityRow(row: PriorityRow): StoredPriority {
  const explainability = row.explainability as StoredPriority["explainability"];

  return {
    id: row.id,
    crawlRunId: row.crawl_run_id,
    websiteId: row.website_id,
    observationId: row.observation_id,
    ruleKey: row.rule_key as StoredPriority["ruleKey"],
    subjectKey: row.subject_key,
    rawPriorityScore: explainability.rawPriorityScore ?? row.priority_score,
    priorityScore: row.priority_score,
    priorityLevel: row.priority_level as StoredPriority["priorityLevel"],
    priorityCeiling: explainability.priorityCeiling ?? null,
    impactScore: row.impact_score,
    reachScore: row.reach_score,
    confidenceScore: row.confidence_score,
    whyItMatters: row.why_it_matters,
    recommendedAction: row.recommended_action,
    verification: row.verification,
    explainability: row.explainability as StoredPriority["explainability"],
    rank: row.rank,
    status: row.status as StoredPriority["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadCrawlRunWebsiteId(crawlRunId: string): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("crawl_runs")
    .select("website_id")
    .eq("id", crawlRunId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load crawl run website: ${error.message}`);
  }

  if (!data?.website_id) {
    throw new Error("Crawl run is missing website_id.");
  }

  return data.website_id;
}

async function loadActiveObservations(
  crawlRunId: string,
): Promise<StoredObservation[]> {
  let observations = await listObservations(crawlRunId);

  if (observations.length === 0) {
    const generated = await generateObservationsForCrawlRun(crawlRunId);
    observations = generated.observations;
  }

  return observations;
}

export async function upsertPriorities(input: {
  crawlRunId: string;
  websiteId: string;
  priorities: PriorityDraft[];
}): Promise<{ insertedOrUpdated: number }> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const activeObservationIds = new Set(
    input.priorities.map((priority) => priority.observationId),
  );

  if (input.priorities.length === 0) {
    await deactivateStalePriorities(input.crawlRunId, activeObservationIds);
    return { insertedOrUpdated: 0 };
  }

  const rows = input.priorities.map((priority) => ({
    crawl_run_id: input.crawlRunId,
    website_id: input.websiteId,
    observation_id: priority.observationId,
    rule_key: priority.ruleKey,
    subject_key: priority.subjectKey,
    priority_score: priority.priorityScore,
    priority_level: priority.priorityLevel,
    impact_score: priority.impactScore,
    reach_score: priority.reachScore,
    confidence_score: priority.confidenceScore,
    why_it_matters: priority.whyItMatters,
    recommended_action: priority.recommendedAction,
    verification: priority.verification,
    explainability: priority.explainability,
    rank: priority.rank,
    status: "active",
    updated_at: now,
  }));

  const { error } = await supabase.from("observation_priorities").upsert(rows, {
    onConflict: "crawl_run_id,observation_id",
  });

  if (error) {
    throw new Error(`Failed to upsert priorities: ${error.message}`);
  }

  await deactivateStalePriorities(input.crawlRunId, activeObservationIds);

  return { insertedOrUpdated: rows.length };
}

async function deactivateStalePriorities(
  crawlRunId: string,
  activeObservationIds: Set<string>,
) {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from("observation_priorities")
    .select("id, observation_id")
    .eq("crawl_run_id", crawlRunId)
    .eq("status", "active");

  if (existingError) {
    throw new Error(`Failed to load existing priorities: ${existingError.message}`);
  }

  const staleIds = (existing ?? [])
    .filter((row) => !activeObservationIds.has(row.observation_id))
    .map((row) => row.id);

  if (staleIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("observation_priorities")
    .update({
      status: "suppressed",
      updated_at: new Date().toISOString(),
    })
    .in("id", staleIds);

  if (error) {
    throw new Error(`Failed to suppress stale priorities: ${error.message}`);
  }
}

export async function listPriorities(crawlRunId: string): Promise<StoredPriority[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("observation_priorities")
    .select(
      "id, crawl_run_id, website_id, observation_id, rule_key, subject_key, priority_score, priority_level, impact_score, reach_score, confidence_score, why_it_matters, recommended_action, verification, explainability, rank, status, created_at, updated_at",
    )
    .eq("crawl_run_id", crawlRunId)
    .eq("status", "active")
    .order("rank", { ascending: true });

  if (error) {
    throw new Error(`Failed to list priorities: ${error.message}`);
  }

  return (data ?? []).map((row) => mapPriorityRow(row as PriorityRow));
}

export async function generatePrioritiesForCrawlRun(crawlRunId: string): Promise<{
  crawlRunId: string;
  generatedCount: number;
  priorities: StoredPriority[];
}> {
  const summary = await getCrawlRunSummary(crawlRunId);
  if (!summary) {
    throw new Error("Crawl run not found.");
  }

  const websiteId = await loadCrawlRunWebsiteId(crawlRunId);
  const observations = await loadActiveObservations(crawlRunId);
  const context = buildPriorityContext({
    crawlRunId,
    websiteId,
    totalPagesCrawled: summary.pagesCrawled,
    observations,
  });

  if (observations.length === 0) {
    await upsertPriorities({ crawlRunId, websiteId, priorities: [] });
    return { crawlRunId, generatedCount: 0, priorities: [] };
  }
  const drafts = generatePriorityDrafts({ observations, context });

  await upsertPriorities({
    crawlRunId,
    websiteId,
    priorities: drafts,
  });

  const priorities = await listPriorities(crawlRunId);

  return {
    crawlRunId,
    generatedCount: priorities.length,
    priorities,
  };
}

export async function previewPrioritiesForCrawlRun(crawlRunId: string): Promise<{
  crawlRunId: string;
  priorities: PriorityDraft[];
  observations: StoredObservation[];
}> {
  const summary = await getCrawlRunSummary(crawlRunId);
  if (!summary) {
    throw new Error("Crawl run not found.");
  }

  const websiteId = await loadCrawlRunWebsiteId(crawlRunId);
  const observations = await loadActiveObservations(crawlRunId);
  const context = buildPriorityContext({
    crawlRunId,
    websiteId,
    totalPagesCrawled: summary.pagesCrawled,
    observations,
  });

  const priorities = generatePriorityDrafts({ observations, context });

  return {
    crawlRunId,
    priorities,
    observations,
  };
}
