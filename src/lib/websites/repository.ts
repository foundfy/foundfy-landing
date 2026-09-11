import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import {
  isUsableCompletedCrawl,
  normalizeCrawlStatusForApiResponse,
} from "@/lib/crawler/crawl-usability";
import type { CrawlLifecycleStatus } from "@/lib/analysis/crawl-status";
import type { WebsiteCrawlRunRecord, WebsiteRecord } from "./types";
import { WEBSITE_SCAN_HISTORY_LIMIT } from "./types";

type WebsiteRow = {
  id: string;
  url: string;
  hostname: string;
  first_seen_at: string;
  last_crawled_at: string | null;
};

type CrawlRunRow = {
  id: string;
  website_id: string;
  status: string;
  seed_url: string;
  max_pages: number;
  pages_crawled: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

function mapWebsiteRow(row: WebsiteRow): WebsiteRecord {
  return {
    id: row.id,
    hostname: row.hostname,
    displayUrl: row.url,
    firstSeenAt: row.first_seen_at,
    lastCrawledAt: row.last_crawled_at,
  };
}

function mapCrawlRunRow(row: CrawlRunRow): WebsiteCrawlRunRecord {
  const normalized = normalizeCrawlStatusForApiResponse({
    status: row.status as WebsiteCrawlRunRecord["status"],
    pagesCrawled: row.pages_crawled,
    errorMessage: row.error_message,
  });

  return {
    id: row.id,
    websiteId: row.website_id,
    status: normalized.status as CrawlLifecycleStatus,
    seedUrl: row.seed_url,
    pagesCrawled: normalized.pagesCrawled,
    maxPages: row.max_pages,
    errorMessage: normalized.errorMessage,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export async function getWebsiteById(websiteId: string): Promise<WebsiteRecord | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("websites")
    .select("id, url, hostname, first_seen_at, last_crawled_at")
    .eq("id", websiteId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load website: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapWebsiteRow(data as WebsiteRow);
}

export async function listCrawlRunsForWebsite(
  websiteId: string,
  limit = WEBSITE_SCAN_HISTORY_LIMIT,
): Promise<WebsiteCrawlRunRecord[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("crawl_runs")
    .select(
      "id, website_id, status, seed_url, max_pages, pages_crawled, error_message, started_at, completed_at, created_at",
    )
    .eq("website_id", websiteId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list crawl runs for website: ${error.message}`);
  }

  return (data ?? []).map((row) => mapCrawlRunRow(row as CrawlRunRow));
}

export async function findLatestUsableCrawlRun(
  websiteId: string,
): Promise<WebsiteCrawlRunRecord | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("crawl_runs")
    .select(
      "id, website_id, status, seed_url, max_pages, pages_crawled, error_message, started_at, completed_at, created_at",
    )
    .eq("website_id", websiteId)
    .eq("status", "completed")
    .gt("pages_crawled", 0)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find latest usable crawl run: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapCrawlRunRow(data as CrawlRunRow);
}

export async function findActiveCrawlRunForWebsite(
  websiteId: string,
): Promise<WebsiteCrawlRunRecord | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("crawl_runs")
    .select(
      "id, website_id, status, seed_url, max_pages, pages_crawled, error_message, started_at, completed_at, created_at",
    )
    .eq("website_id", websiteId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to find active crawl run: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapCrawlRunRow(data as CrawlRunRow);
}

export function isUsableWebsiteCrawlRun(run: WebsiteCrawlRunRecord): boolean {
  return isUsableCompletedCrawl({
    status: run.status,
    pagesCrawled: run.pagesCrawled,
  });
}
