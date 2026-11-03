import { getSupabaseAdmin } from "@/lib/db/supabase-admin";
import type { GoogleIndexingEvidenceInput } from "@/lib/foundations/types";
import { findLatestUsableCrawlRun } from "@/lib/websites/repository";
import { GOOGLE_INDEXING_MAX_URLS, GOOGLE_INDEXING_REUSE_MS } from "./config";
import { decryptSecret } from "./crypto";
import { refreshGoogleAccessToken } from "./google";
import { interpretIndexStatus, interpretSitemapsList } from "./indexing-interpret";
import {
  selectInspectionUrls,
  type IndexingPageCandidate,
} from "./indexing-urls";
import { requireSearchConsoleConnection } from "./observe";
import { googleCapabilitiesFromScopes } from "./scopes";
import { listSearchConsoleSitemaps } from "./sitemaps";
import {
  GoogleAuthExpiredError,
  SearchConsoleNotConnectedError,
} from "./types";
import { inspectUrlIndexStatus } from "./url-inspection";

export type GoogleIndexingCheckView = Extract<GoogleIndexingEvidenceInput, { kind: "checked" }>;

type CacheEntry = {
  websiteId: string;
  ownerIdentityId: string;
  propertyUri: string;
  checkedAt: number;
  view: GoogleIndexingCheckView | null;
  inFlight: Promise<GoogleIndexingCheckView> | null;
};

const cache = new Map<string, CacheEntry>();

function indexingCacheKey(
  websiteId: string,
  ownerIdentityId: string,
  propertyUri: string,
): string {
  return `${websiteId}:${ownerIdentityId}:${propertyUri}`;
}

function readRefreshToken(ciphertext: string | undefined): string {
  if (!ciphertext || ciphertext === "revoked") {
    throw new GoogleAuthExpiredError();
  }

  try {
    return decryptSecret(ciphertext);
  } catch {
    throw new GoogleAuthExpiredError();
  }
}

export function resetGoogleIndexingCheckCacheForTests(): void {
  cache.clear();
}

export async function listFetchedPagesForIndexing(
  websiteId: string,
): Promise<IndexingPageCandidate[]> {
  const crawl = await findLatestUsableCrawlRun(websiteId);
  if (!crawl) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pages")
    .select("requested_url, final_url, status_code")
    .eq("crawl_run_id", crawl.id);

  if (error) {
    throw new Error(`Failed to load pages for Google indexing: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    requestedUrl: row.requested_url as string,
    finalUrl: row.final_url as string,
    statusCode: typeof row.status_code === "number" ? row.status_code : null,
  }));
}

export async function listCrawledSitemapUrls(websiteId: string): Promise<string[]> {
  const crawl = await findLatestUsableCrawlRun(websiteId);
  if (!crawl) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("crawl_site_artifacts")
    .select("url")
    .eq("crawl_run_id", crawl.id)
    .eq("artifact_type", "sitemap_xml");

  if (error) {
    throw new Error(`Failed to load crawled sitemaps for Google indexing: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => (typeof row.url === "string" ? row.url : ""))
    .filter((url) => url.length > 0);
}

async function runGoogleIndexingCheck(input: {
  websiteId: string;
  sessionToken: string | null;
  now?: Date;
}): Promise<GoogleIndexingCheckView> {
  const context = await requireSearchConsoleConnection({
    websiteId: input.websiteId,
    sessionToken: input.sessionToken,
  });

  if (!context.token || context.token.revokedAt) {
    throw new GoogleAuthExpiredError();
  }

  if (!googleCapabilitiesFromScopes(context.token.scopes).canReadSearchConsole) {
    throw new SearchConsoleNotConnectedError();
  }

  const ownerIdentityId = context.owner.googleIdentityId;
  const propertyUri = context.connection.propertyUri;
  const now = input.now ?? new Date();
  const key = indexingCacheKey(input.websiteId, ownerIdentityId, propertyUri);
  const existing = cache.get(key);

  if (existing?.inFlight) {
    return existing.inFlight;
  }

  if (
    existing?.view &&
    existing.checkedAt > 0 &&
    now.getTime() - existing.checkedAt < GOOGLE_INDEXING_REUSE_MS
  ) {
    return { ...existing.view, reused: true };
  }

  const pending = (async () => {
    const refreshToken = readRefreshToken(context.token?.refreshTokenCiphertext);
    const accessToken = await refreshGoogleAccessToken(refreshToken);
    const [pages, crawledSitemapUrls] = await Promise.all([
      listFetchedPagesForIndexing(input.websiteId),
      listCrawledSitemapUrls(input.websiteId),
    ]);
    const selected = selectInspectionUrls({
      pages,
      website: context.website,
      propertyUri,
      limit: GOOGLE_INDEXING_MAX_URLS,
    });
    const inspectedAt = now.toISOString();
    const sitemaps = await listSearchConsoleSitemaps({
      accessToken,
      propertyUri,
    });
    const urls = [];
    for (const target of selected) {
      const status = await inspectUrlIndexStatus({
        accessToken,
        inspectionUrl: target.url,
        siteUrl: propertyUri,
      });
      urls.push(
        interpretIndexStatus({
          url: target.url,
          role: target.role,
          inspectedAt,
          status,
        }),
      );
    }

    const view: GoogleIndexingCheckView = {
      kind: "checked",
      inspectedAt,
      reused: false,
      urls,
      sitemap: interpretSitemapsList({
        sitemaps,
        crawledSitemapUrls,
      }),
    };

    cache.set(key, {
      websiteId: input.websiteId,
      ownerIdentityId,
      propertyUri,
      checkedAt: now.getTime(),
      view,
      inFlight: null,
    });

    return view;
  })();

  cache.set(key, {
    websiteId: input.websiteId,
    ownerIdentityId,
    propertyUri,
    checkedAt: existing?.checkedAt ?? 0,
    view: existing?.view ?? null,
    inFlight: pending,
  });

  try {
    return await pending;
  } catch (error) {
    const current = cache.get(key);
    if (current?.inFlight === pending) {
      if (current.view && current.checkedAt > 0) {
        cache.set(key, { ...current, inFlight: null });
      } else {
        cache.delete(key);
      }
    }
    throw error;
  }
}

export async function checkGoogleIndexing(input: {
  websiteId: string;
  sessionToken: string | null;
  now?: Date;
}): Promise<GoogleIndexingCheckView> {
  return runGoogleIndexingCheck(input);
}
