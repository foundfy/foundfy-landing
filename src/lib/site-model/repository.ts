import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type { JsonLdPropertySnippet } from "@/lib/crawler/types";
import type {
  SiteModelArtifactInput,
  SiteModelEvidence,
  SiteModelPageInput,
  SiteModelRecord,
  SiteModelStatus,
  SiteModelUnderstanding,
} from "./types";

type SiteModelRow = {
  id: string;
  website_id: string;
  source_crawl_run_id: string;
  version: number;
  status: SiteModelStatus;
  understanding: SiteModelUnderstanding;
  interpretation: Record<string, unknown> | null;
  confirmed: Record<string, unknown> | null;
  evidence: SiteModelEvidence;
  derived_at: string;
};

type PageRow = {
  id: string;
  requested_url: string;
  final_url: string;
  status_code: number | null;
  title: string | null;
  h1: string[] | null;
  h2: string[] | null;
  h3: string[] | null;
  html_lang: string | null;
  url_locale: string | null;
  nav_labels: string[] | null;
  main_excerpt: string | null;
  content_hash: string | null;
  json_ld_types: string[] | null;
  json_ld_properties: JsonLdPropertySnippet[] | null;
  word_count: number | null;
  fetched_at: string | null;
};

type ArtifactRow = {
  id: string;
  artifact_type: "robots_txt" | "sitemap_xml";
  url: string;
  status_code: number | null;
};

type CrawlRunEvidenceRow = {
  id: string;
  website_id: string;
  seed_url: string;
  pages_crawled: number;
  pages_discovered: number;
  max_pages: number;
};

function mapSiteModelRow(row: SiteModelRow): SiteModelRecord {
  return {
    id: row.id,
    websiteId: row.website_id,
    sourceCrawlRunId: row.source_crawl_run_id,
    version: row.version,
    status: row.status,
    understanding: row.understanding,
    interpretation: row.interpretation,
    confirmed: row.confirmed,
    evidence: row.evidence,
    derivedAt: row.derived_at,
  };
}

export function mapPageRow(row: PageRow): SiteModelPageInput {
  return {
    id: row.id,
    requestedUrl: row.requested_url,
    finalUrl: row.final_url,
    statusCode: row.status_code,
    title: row.title,
    h1: row.h1,
    h2: row.h2,
    h3: row.h3,
    htmlLang: row.html_lang,
    urlLocale: row.url_locale,
    navLabels: row.nav_labels,
    mainExcerpt: row.main_excerpt,
    contentHash: row.content_hash,
    jsonLdTypes: row.json_ld_types,
    jsonLdProperties: row.json_ld_properties,
    wordCount: row.word_count,
    fetchedAt: row.fetched_at,
  };
}

export async function findSiteModelForCrawl(
  websiteId: string,
  crawlRunId: string,
): Promise<SiteModelRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("site_models")
    .select(
      "id, website_id, source_crawl_run_id, version, status, understanding, interpretation, confirmed, evidence, derived_at",
    )
    .eq("website_id", websiteId)
    .eq("source_crawl_run_id", crawlRunId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load site model: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapSiteModelRow(data as SiteModelRow);
}

export async function insertSiteModel(input: {
  websiteId: string;
  sourceCrawlRunId: string;
  version: number;
  status: SiteModelStatus;
  understanding: SiteModelUnderstanding;
  evidence: SiteModelEvidence;
}): Promise<SiteModelRecord> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("site_models")
    .insert({
      website_id: input.websiteId,
      source_crawl_run_id: input.sourceCrawlRunId,
      version: input.version,
      status: input.status,
      understanding: input.understanding,
      interpretation: null,
      confirmed: null,
      evidence: input.evidence,
      derived_at: now,
      updated_at: now,
    })
    .select(
      "id, website_id, source_crawl_run_id, version, status, understanding, interpretation, confirmed, evidence, derived_at",
    )
    .single();

  if (error) {
    throw new Error(`Failed to save site model: ${error.message}`);
  }

  return mapSiteModelRow(data as SiteModelRow);
}

export async function updateDraftSiteModel(input: {
  id: string;
  understanding: SiteModelUnderstanding;
  evidence: SiteModelEvidence;
}): Promise<SiteModelRecord> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("site_models")
    .update({
      understanding: input.understanding,
      evidence: input.evidence,
      derived_at: now,
      updated_at: now,
    })
    .eq("id", input.id)
    .eq("status", "draft")
    .select(
      "id, website_id, source_crawl_run_id, version, status, understanding, interpretation, confirmed, evidence, derived_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update site model: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to update site model: draft row was not found.");
  }

  return mapSiteModelRow(data as SiteModelRow);
}

export async function loadSiteModelEvidence(crawlRunId: string): Promise<{
  crawl: CrawlRunEvidenceRow;
  pages: SiteModelPageInput[];
  artifacts: SiteModelArtifactInput[];
} | null> {
  const supabase = getSupabaseAdmin();

  const { data: crawl, error: crawlError } = await supabase
    .from("crawl_runs")
    .select("id, website_id, seed_url, pages_crawled, pages_discovered, max_pages")
    .eq("id", crawlRunId)
    .maybeSingle();

  if (crawlError) {
    throw new Error(`Failed to load crawl run for site model: ${crawlError.message}`);
  }

  if (!crawl) {
    return null;
  }

  const [{ data: pages, error: pagesError }, { data: artifacts, error: artifactsError }] =
    await Promise.all([
      supabase
        .from("pages")
        .select(
          "id, requested_url, final_url, status_code, title, h1, h2, h3, html_lang, url_locale, nav_labels, main_excerpt, content_hash, json_ld_types, json_ld_properties, word_count, fetched_at",
        )
        .eq("crawl_run_id", crawlRunId)
        .order("fetched_at", { ascending: true }),
      supabase
        .from("crawl_site_artifacts")
        .select("id, artifact_type, url, status_code")
        .eq("crawl_run_id", crawlRunId),
    ]);

  if (pagesError) {
    throw new Error(`Failed to load pages for site model: ${pagesError.message}`);
  }

  if (artifactsError) {
    throw new Error(`Failed to load artifacts for site model: ${artifactsError.message}`);
  }

  return {
    crawl: crawl as CrawlRunEvidenceRow,
    pages: (pages ?? []).map((row) => mapPageRow(row as PageRow)),
    artifacts: ((artifacts ?? []) as ArtifactRow[]).map((row) => ({
      id: row.id,
      artifactType: row.artifact_type,
      url: row.url,
      statusCode: row.status_code,
    })),
  };
}
