import { normalizeCrawlUrl, normalizeSiteHostname } from "@/lib/crawler/url/normalize";

export function normalizeComparableUrl(url: string, baseUrl?: string): string | null {
  return normalizeCrawlUrl(url, baseUrl);
}

export function urlsMatch(left: string, right: string, baseUrl?: string): boolean {
  const normalizedLeft = normalizeComparableUrl(left, baseUrl);
  const normalizedRight = normalizeComparableUrl(right, baseUrl);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}

export function hasNoindex(robotsMeta: string | null, xRobotsTag: string | null): boolean {
  const combined = `${robotsMeta ?? ""} ${xRobotsTag ?? ""}`.toLowerCase();
  return combined.includes("noindex");
}

export function isIndexablePage(page: {
  statusCode: number | null;
  robotsMeta: string | null;
  xRobotsTag: string | null;
}): boolean {
  if (page.statusCode !== 200) {
    return false;
  }

  return !hasNoindex(page.robotsMeta, page.xRobotsTag);
}

export function groupByNormalizedValue<T>(
  items: T[],
  getValue: (item: T) => string | null | undefined,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const raw = getValue(item)?.trim();
    if (!raw) {
      continue;
    }

    const key = raw.toLowerCase();
    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  }

  return groups;
}

export function buildPageSubjectKey(pageId: string): string {
  return `page:${pageId}`;
}

export function buildQueueSubjectKey(queueId: string): string {
  return `queue:${queueId}`;
}

export function buildLinkSubjectKey(linkId: string): string {
  return `link:${linkId}`;
}

export function buildSiteSubjectKey(suffix: string): string {
  return `site:${suffix}`;
}

export function buildUrlSubjectKey(url: string, baseUrl?: string): string {
  const normalized = normalizeComparableUrl(url, baseUrl);
  return `url:${normalized ?? url}`;
}

export function sameSiteHostname(url: string, siteHostname: string): boolean {
  try {
    const parsed = new URL(url);
    return normalizeSiteHostname(parsed.hostname) === normalizeSiteHostname(siteHostname);
  } catch {
    return false;
  }
}

export function extractSitemapUrls(artifacts: Array<{ parsed: Record<string, unknown> | null }>): string[] {
  const urls = new Set<string>();

  for (const artifact of artifacts) {
    const parsedUrls = artifact.parsed?.urls;
    if (!Array.isArray(parsedUrls)) {
      continue;
    }

    for (const entry of parsedUrls) {
      if (typeof entry === "string" && entry.trim()) {
        urls.add(entry.trim());
      }
    }
  }

  return [...urls];
}
