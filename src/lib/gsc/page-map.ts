import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import { findLatestUsableCrawlRun } from "@/lib/websites/repository";

export type FoundfyPageRef = {
  id: string;
  requestedUrl: string;
  finalUrl: string;
  canonical: string | null;
};

function stripWww(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, "");
}

function normalizePathname(pathname: string): string {
  if (pathname === "" || pathname === "/") {
    return "/";
  }

  return pathname.replace(/\/+$/, "") || "/";
}

/**
 * Comparison key for confident mapping. Preserves path and query string.
 * Treats http/https, www/apex, trailing slashes, and hashes as equivalent.
 * Does not rewrite Google's stored page URL.
 */
export function pageComparisonKey(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = stripWww(parsed.hostname);
  if (!host) {
    return null;
  }

  return `https://${host}${normalizePathname(parsed.pathname)}${parsed.search}`;
}

export function mapGscPageUrl(
  gscPageUrl: string,
  pages: FoundfyPageRef[],
): string | null {
  const exact = pages.find(
    (page) =>
      page.requestedUrl === gscPageUrl ||
      page.finalUrl === gscPageUrl ||
      page.canonical === gscPageUrl,
  );
  if (exact) {
    return exact.id;
  }

  const gscKey = pageComparisonKey(gscPageUrl);
  if (!gscKey) {
    return null;
  }

  const comparable = pages.find((page) => {
    const candidates = [page.requestedUrl, page.finalUrl, page.canonical].filter(
      (value): value is string => Boolean(value),
    );
    return candidates.some((candidate) => pageComparisonKey(candidate) === gscKey);
  });

  return comparable?.id ?? null;
}

export async function listFoundfyPagesForMapping(websiteId: string): Promise<FoundfyPageRef[]> {
  const crawl = await findLatestUsableCrawlRun(websiteId);
  if (!crawl) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pages")
    .select("id, requested_url, final_url, canonical")
    .eq("crawl_run_id", crawl.id);

  if (error) {
    throw new Error(`Failed to load pages for Search Analytics mapping: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    requestedUrl: row.requested_url as string,
    finalUrl: row.final_url as string,
    canonical: typeof row.canonical === "string" ? row.canonical : null,
  }));
}
