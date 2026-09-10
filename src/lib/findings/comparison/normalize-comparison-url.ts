import {
  normalizeCrawlUrl,
  normalizeSiteHostname,
} from "@/lib/crawler/url/normalize";

export function normalizeComparisonUrl(
  url: string | null | undefined,
  baseUrl?: string,
): string | null {
  if (!url) {
    return null;
  }

  const normalized = normalizeCrawlUrl(url, baseUrl);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    parsed.hostname = normalizeSiteHostname(parsed.hostname);
    return parsed.toString();
  } catch {
    return null;
  }
}
