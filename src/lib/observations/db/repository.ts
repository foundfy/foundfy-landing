import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type {
  CrawlArtifactEvidence,
  CrawlEvidenceContext,
  CrawlLinkEvidence,
  CrawlPageEvidence,
  CrawlQueueEvidence,
  ObservationDraft,
  StoredObservation,
} from "../types";

type PageRow = {
  id: string;
  requested_url: string;
  final_url: string;
  status_code: number | null;
  redirect_chain: CrawlPageEvidence["redirectChain"];
  title: string | null;
  meta_description: string | null;
  canonical: string | null;
  robots_meta: string | null;
  x_robots_tag: string | null;
  h1: string[];
  internal_link_count: number;
};

export async function loadCrawlEvidenceContext(
  crawlRunId: string,
): Promise<CrawlEvidenceContext | null> {
  const supabase = getSupabaseAdmin();

  const { data: run, error: runError } = await supabase
    .from("crawl_runs")
    .select("id, website_id, seed_url, websites(hostname)")
    .eq("id", crawlRunId)
    .maybeSingle();

  if (runError) {
    throw new Error(`Failed to load crawl run: ${runError.message}`);
  }

  if (!run) {
    return null;
  }

  const website = Array.isArray(run.websites) ? run.websites[0] : run.websites;
  if (!website?.hostname) {
    throw new Error("Crawl run is missing website hostname.");
  }

  const [{ data: pages, error: pagesError }, { data: links, error: linksError }, { data: queue, error: queueError }, { data: artifacts, error: artifactsError }] =
    await Promise.all([
      supabase
        .from("pages")
        .select(
          "id, requested_url, final_url, status_code, redirect_chain, title, meta_description, canonical, robots_meta, x_robots_tag, h1, internal_link_count",
        )
        .eq("crawl_run_id", crawlRunId),
      supabase
        .from("links")
        .select("id, from_page_id, to_url, link_type, anchor_text")
        .eq("crawl_run_id", crawlRunId),
      supabase
        .from("crawl_queue")
        .select("id, url, status, skip_reason")
        .eq("crawl_run_id", crawlRunId),
      supabase
        .from("crawl_site_artifacts")
        .select("id, artifact_type, url, status_code, parsed")
        .eq("crawl_run_id", crawlRunId),
    ]);

  if (pagesError) {
    throw new Error(`Failed to load pages: ${pagesError.message}`);
  }

  if (linksError) {
    throw new Error(`Failed to load links: ${linksError.message}`);
  }

  if (queueError) {
    throw new Error(`Failed to load crawl queue: ${queueError.message}`);
  }

  if (artifactsError) {
    throw new Error(`Failed to load crawl artifacts: ${artifactsError.message}`);
  }

  return {
    crawlRunId,
    websiteId: run.website_id,
    hostname: website.hostname,
    seedUrl: run.seed_url,
    pages: ((pages ?? []) as PageRow[]).map(mapPageRow),
    links: (
      (links ?? []) as Array<{
        id: string;
        from_page_id: string;
        to_url: string;
        link_type: "internal" | "external";
        anchor_text: string | null;
      }>
    ).map(
      (link): CrawlLinkEvidence => ({
        id: link.id,
        fromPageId: link.from_page_id,
        toUrl: link.to_url,
        linkType: link.link_type,
        anchorText: link.anchor_text,
      }),
    ),
    queue: ((queue ?? []) as Array<{
      id: string;
      url: string;
      status: string;
      skip_reason: string | null;
    }>).map(
      (item): CrawlQueueEvidence => ({
        id: item.id,
        url: item.url,
        status: item.status,
        skipReason: item.skip_reason,
      }),
    ),
    artifacts: ((artifacts ?? []) as Array<{
      id: string;
      artifact_type: "robots_txt" | "sitemap_xml";
      url: string;
      status_code: number | null;
      parsed: Record<string, unknown> | null;
    }>).map(
      (artifact): CrawlArtifactEvidence => ({
        id: artifact.id,
        artifactType: artifact.artifact_type,
        url: artifact.url,
        statusCode: artifact.status_code,
        parsed: artifact.parsed,
      }),
    ),
  };
}

function mapPageRow(row: PageRow): CrawlPageEvidence {
  return {
    id: row.id,
    requestedUrl: row.requested_url,
    finalUrl: row.final_url,
    statusCode: row.status_code,
    redirectChain: row.redirect_chain ?? [],
    title: row.title,
    metaDescription: row.meta_description,
    canonical: row.canonical,
    robotsMeta: row.robots_meta,
    xRobotsTag: row.x_robots_tag,
    h1: row.h1 ?? [],
    internalLinkCount: row.internal_link_count,
  };
}

export async function upsertObservations(input: {
  crawlRunId: string;
  websiteId: string;
  observations: ObservationDraft[];
}): Promise<{ insertedOrUpdated: number }> {
  if (input.observations.length === 0) {
    await deactivateStaleObservations(input.crawlRunId, new Set());
    return { insertedOrUpdated: 0 };
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const activeSubjectKeys = new Set(
    input.observations.map((observation) => observation.subjectKey),
  );

  const rows = input.observations.map((observation) => ({
    crawl_run_id: input.crawlRunId,
    website_id: input.websiteId,
    page_id: observation.pageId ?? null,
    rule_key: observation.ruleKey,
    category: observation.category,
    severity: observation.severity,
    title: observation.title,
    description: observation.description,
    page_url: observation.pageUrl ?? null,
    subject_key: observation.subjectKey,
    evidence: observation.evidence,
    status: "active",
    updated_at: now,
  }));

  const { error } = await supabase.from("observations").upsert(rows, {
    onConflict: "crawl_run_id,rule_key,subject_key",
  });

  if (error) {
    throw new Error(`Failed to upsert observations: ${error.message}`);
  }

  await deactivateStaleObservations(input.crawlRunId, activeSubjectKeys);

  return { insertedOrUpdated: rows.length };
}

async function deactivateStaleObservations(
  crawlRunId: string,
  activeSubjectKeys: Set<string>,
) {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from("observations")
    .select("id, subject_key")
    .eq("crawl_run_id", crawlRunId)
    .eq("status", "active");

  if (existingError) {
    throw new Error(`Failed to load existing observations: ${existingError.message}`);
  }

  const staleIds = (existing ?? [])
    .filter((row) => !activeSubjectKeys.has(row.subject_key))
    .map((row) => row.id);

  if (staleIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("observations")
    .update({
      status: "suppressed",
      updated_at: new Date().toISOString(),
    })
    .in("id", staleIds);

  if (error) {
    throw new Error(`Failed to suppress stale observations: ${error.message}`);
  }
}

export async function countActiveObservations(crawlRunId: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { count, error } = await supabase
    .from("observations")
    .select("id", { count: "exact", head: true })
    .eq("crawl_run_id", crawlRunId)
    .eq("status", "active");

  if (error) {
    throw new Error(`Failed to count observations: ${error.message}`);
  }

  return count ?? 0;
}

export async function listObservations(crawlRunId: string): Promise<StoredObservation[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("observations")
    .select(
      "id, crawl_run_id, website_id, page_id, rule_key, category, severity, title, description, page_url, subject_key, evidence, status, created_at, updated_at",
    )
    .eq("crawl_run_id", crawlRunId)
    .eq("status", "active")
    .order("category", { ascending: true })
    .order("severity", { ascending: true })
    .order("rule_key", { ascending: true });

  if (error) {
    throw new Error(`Failed to list observations: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    crawlRunId: row.crawl_run_id,
    websiteId: row.website_id,
    pageId: row.page_id,
    ruleKey: row.rule_key,
    category: row.category,
    severity: row.severity,
    title: row.title,
    description: row.description,
    pageUrl: row.page_url,
    subjectKey: row.subject_key,
    evidence: row.evidence as Record<string, unknown>,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function generateObservationsForCrawlRun(crawlRunId: string): Promise<{
  crawlRunId: string;
  generatedCount: number;
  observations: StoredObservation[];
}> {
  const context = await loadCrawlEvidenceContext(crawlRunId);
  if (!context) {
    throw new Error("Crawl run not found.");
  }

  const { generateObservationDrafts } = await import("../engine");
  const drafts = generateObservationDrafts(context);
  await upsertObservations({
    crawlRunId: context.crawlRunId,
    websiteId: context.websiteId,
    observations: drafts,
  });

  const observations = await listObservations(crawlRunId);
  await markObservationsMaterialized(crawlRunId);

  return {
    crawlRunId,
    generatedCount: observations.length,
    observations,
  };
}

async function markObservationsMaterialized(crawlRunId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("crawl_runs")
    .update({ observations_materialized_at: now })
    .eq("id", crawlRunId);

  if (error) {
    throw new Error(`Failed to mark observations materialized: ${error.message}`);
  }
}

export async function areObservationsMaterialized(crawlRunId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("crawl_runs")
    .select("observations_materialized_at")
    .eq("id", crawlRunId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check observation materialization: ${error.message}`);
  }

  return Boolean(data?.observations_materialized_at);
}
