import { GOOGLE_WEBMASTERS_SITES_URL } from "./config";
import { discardGoogleErrorBody } from "./google-write";
import type { GoogleSitemapListEntry } from "./indexing-interpret";
import { GoogleAuthExpiredError, GoogleIndexingError } from "./types";

type SitemapsListJson = {
  sitemap?: GoogleSitemapListEntry[];
};

function mapSitemapError(status: number): never {
  if (status === 401 || status === 403) {
    throw new GoogleAuthExpiredError();
  }

  if (status === 429) {
    throw new GoogleIndexingError("quota");
  }

  if (status >= 500) {
    throw new GoogleIndexingError("unavailable");
  }

  throw new GoogleIndexingError("malformed");
}

export function sitemapsListUrl(propertyUri: string): string {
  return `${GOOGLE_WEBMASTERS_SITES_URL}/${encodeURIComponent(propertyUri)}/sitemaps`;
}

export async function listSearchConsoleSitemaps(input: {
  accessToken: string;
  propertyUri: string;
  fetchImpl?: typeof fetch;
}): Promise<GoogleSitemapListEntry[]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(sitemapsListUrl(input.propertyUri), {
    headers: { Authorization: `Bearer ${input.accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    await discardGoogleErrorBody(response);
    mapSitemapError(response.status);
  }

  const payload = (await response.json().catch(() => ({}))) as SitemapsListJson;
  return Array.isArray(payload.sitemap) ? payload.sitemap : [];
}
