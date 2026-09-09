import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type {
  CrawlRunStatus,
  CrawlRunSummary,
  LinkType,
  ParsedPage,
  QueueItemStatus,
  RobotsRules,
  SiteArtifactType,
} from "../types";

type WebsiteRow = {
  id: string;
  url: string;
  hostname: string;
};

type CrawlRunRow = {
  id: string;
  website_id: string;
  status: CrawlRunStatus;
  seed_url: string;
  max_pages: number;
  pages_crawled: number;
  pages_discovered: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  websites: WebsiteRow | WebsiteRow[] | null;
};

type QueueRow = {
  id: string;
  url: string;
  depth: number;
  priority: number;
  status: QueueItemStatus;
};

function unwrapWebsite(row: CrawlRunRow): WebsiteRow | null {
  if (!row.websites) {
    return null;
  }

  return Array.isArray(row.websites) ? row.websites[0] ?? null : row.websites;
}

export async function upsertWebsite(url: string, hostname: string): Promise<WebsiteRow> {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: lookupError } = await supabase
    .from("websites")
    .select("id, url, hostname")
    .eq("hostname", hostname)
    .maybeSingle();

  if (lookupError) {
    console.error("[Crawl] Website lookup failed:", {
      message: lookupError.message,
      code: lookupError.code,
      details: lookupError.details,
      hint: lookupError.hint,
    });
    throw new Error(`Failed to lookup website: ${lookupError.message}`);
  }

  if (existing) {
    const { data, error } = await supabase
      .from("websites")
      .update({ url })
      .eq("id", existing.id)
      .select("id, url, hostname")
      .single();

    if (error || !data) {
      if (error) {
        console.error("[Crawl] Website update failed:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
      }
      throw new Error(`Failed to update website: ${error?.message ?? "unknown error"}`);
    }

    return data;
  }

  const { data, error } = await supabase
    .from("websites")
    .insert({ url, hostname })
    .select("id, url, hostname")
    .single();

  if (error || !data) {
    if (error) {
      console.error("[Crawl] Website insert failed:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }
    throw new Error(`Failed to create website: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

export async function createCrawlRun(input: {
  websiteId: string;
  seedUrl: string;
  maxPages: number;
}): Promise<{ id: string }> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("crawl_runs")
    .insert({
      website_id: input.websiteId,
      seed_url: input.seedUrl,
      max_pages: input.maxPages,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error) {
      console.error("[Crawl] Crawl run insert failed:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }
    throw new Error(`Failed to create crawl run: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

export async function enqueueUrl(input: {
  crawlRunId: string;
  url: string;
  depth?: number;
  priority?: number;
}): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("crawl_queue").upsert(
    {
      crawl_run_id: input.crawlRunId,
      url: input.url,
      depth: input.depth ?? 0,
      priority: input.priority ?? 0,
      status: "pending",
      skip_reason: null,
    },
    { onConflict: "crawl_run_id,url", ignoreDuplicates: true },
  );

  if (error) {
    console.error("[Crawl] Queue enqueue failed:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`Failed to enqueue URL: ${error.message}`);
  }
}

export async function getCrawlRunSummary(crawlRunId: string): Promise<CrawlRunSummary | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("crawl_runs")
    .select(
      "id, status, seed_url, max_pages, pages_crawled, pages_discovered, error_message, started_at, completed_at, created_at, websites(hostname)",
    )
    .eq("id", crawlRunId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch crawl run: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as CrawlRunRow;
  const website = unwrapWebsite(row);

  return {
    id: row.id,
    status: row.status,
    hostname: website?.hostname ?? "",
    seedUrl: row.seed_url,
    maxPages: row.max_pages,
    pagesCrawled: row.pages_crawled,
    pagesDiscovered: row.pages_discovered,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export async function claimNextQueuedRun(preferredRunId?: string): Promise<CrawlRunRow | null> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("crawl_runs")
    .select(
      "id, website_id, status, seed_url, max_pages, pages_crawled, pages_discovered, error_message, started_at, completed_at, created_at, websites(id, url, hostname)",
    )
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (preferredRunId) {
    query = supabase
      .from("crawl_runs")
      .select(
        "id, website_id, status, seed_url, max_pages, pages_crawled, pages_discovered, error_message, started_at, completed_at, created_at, websites(id, url, hostname)",
      )
      .eq("id", preferredRunId)
      .eq("status", "queued")
      .limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Failed to claim crawl run: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as CrawlRunRow;

  const { error: updateError } = await supabase
    .from("crawl_runs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", row.id)
    .eq("status", "queued");

  if (updateError) {
    throw new Error(`Failed to mark crawl run running: ${updateError.message}`);
  }

  return row;
}

export async function markCrawlRunCompleted(crawlRunId: string, websiteId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const completedAt = new Date().toISOString();

  const { error: runError } = await supabase
    .from("crawl_runs")
    .update({
      status: "completed",
      completed_at: completedAt,
    })
    .eq("id", crawlRunId);

  if (runError) {
    throw new Error(`Failed to complete crawl run: ${runError.message}`);
  }

  const { error: websiteError } = await supabase
    .from("websites")
    .update({ last_crawled_at: completedAt })
    .eq("id", websiteId);

  if (websiteError) {
    throw new Error(`Failed to update website crawl timestamp: ${websiteError.message}`);
  }
}

export async function markCrawlRunFailed(crawlRunId: string, message: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("crawl_runs")
    .update({
      status: "failed",
      error_message: message.slice(0, 1000),
      completed_at: new Date().toISOString(),
    })
    .eq("id", crawlRunId);

  if (error) {
    throw new Error(`Failed to mark crawl run failed: ${error.message}`);
  }
}

export async function saveSiteArtifact(input: {
  crawlRunId: string;
  websiteId: string;
  artifactType: SiteArtifactType;
  url: string;
  statusCode: number | null;
  content: string | null;
  parsed: unknown;
}): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("crawl_site_artifacts").insert({
    crawl_run_id: input.crawlRunId,
    website_id: input.websiteId,
    artifact_type: input.artifactType,
    url: input.url,
    status_code: input.statusCode,
    content: input.content,
    parsed: input.parsed,
  });

  if (error) {
    throw new Error(`Failed to save site artifact: ${error.message}`);
  }
}

export async function getNextQueueItem(crawlRunId: string): Promise<QueueRow | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("crawl_queue")
    .select("id, url, depth, priority, status")
    .eq("crawl_run_id", crawlRunId)
    .eq("status", "pending")
    .order("priority", { ascending: false })
    .order("depth", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch queue item: ${error.message}`);
  }

  return data as QueueRow | null;
}

export async function updateQueueItem(
  queueItemId: string,
  status: QueueItemStatus,
  skipReason?: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("crawl_queue")
    .update({
      status,
      skip_reason: skipReason ?? null,
    })
    .eq("id", queueItemId);

  if (error) {
    throw new Error(`Failed to update queue item: ${error.message}`);
  }
}

export async function incrementCrawlProgress(
  crawlRunId: string,
  pagesCrawledDelta: number,
  pagesDiscoveredDelta: number,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const summary = await getCrawlRunSummary(crawlRunId);

  if (!summary) {
    throw new Error("Crawl run not found while updating progress.");
  }

  const { error } = await supabase
    .from("crawl_runs")
    .update({
      pages_crawled: summary.pagesCrawled + pagesCrawledDelta,
      pages_discovered: summary.pagesDiscovered + pagesDiscoveredDelta,
    })
    .eq("id", crawlRunId);

  if (error) {
    throw new Error(`Failed to update crawl progress: ${error.message}`);
  }
}

export async function saveParsedPage(input: {
  crawlRunId: string;
  websiteId: string;
  parsed: ParsedPage;
}): Promise<string> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("pages")
    .insert({
      crawl_run_id: input.crawlRunId,
      website_id: input.websiteId,
      requested_url: input.parsed.requestedUrl,
      final_url: input.parsed.finalUrl,
      status_code: input.parsed.statusCode,
      redirect_chain: input.parsed.redirectChain,
      title: input.parsed.title,
      meta_description: input.parsed.metaDescription,
      canonical: input.parsed.canonical,
      robots_meta: input.parsed.robotsMeta,
      x_robots_tag: input.parsed.xRobotsTag,
      h1: input.parsed.h1,
      h2: input.parsed.h2,
      html_lang: input.parsed.htmlLang,
      internal_link_count: input.parsed.internalLinks.length,
      external_link_count: input.parsed.externalLinks.length,
      image_count: input.parsed.imageCount,
      missing_alt_count: input.parsed.missingAltCount,
      json_ld_types: input.parsed.jsonLdTypes,
      word_count: input.parsed.wordCount,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to save page: ${error?.message ?? "unknown error"}`);
  }

  return data.id;
}

export async function saveLinks(input: {
  crawlRunId: string;
  fromPageId: string;
  links: Array<{ url: string; anchorText: string | null; linkType: LinkType }>;
}): Promise<void> {
  if (input.links.length === 0) {
    return;
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("links").insert(
    input.links.map((link) => ({
      crawl_run_id: input.crawlRunId,
      from_page_id: input.fromPageId,
      to_url: link.url,
      link_type: link.linkType,
      anchor_text: link.anchorText,
    })),
  );

  if (error) {
    throw new Error(`Failed to save links: ${error.message}`);
  }
}

export type ActiveCrawlRun = {
  id: string;
  websiteId: string;
  websiteUrl: string;
  hostname: string;
  seedUrl: string;
  maxPages: number;
};

export function toActiveCrawlRun(row: CrawlRunRow): ActiveCrawlRun | null {
  const website = unwrapWebsite(row);
  if (!website) {
    return null;
  }

  return {
    id: row.id,
    websiteId: website.id,
    websiteUrl: website.url,
    hostname: website.hostname,
    seedUrl: row.seed_url,
    maxPages: row.max_pages,
  };
}

export type { RobotsRules };
