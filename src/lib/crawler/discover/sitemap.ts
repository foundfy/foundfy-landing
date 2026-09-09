import { XMLParser } from "fast-xml-parser";
import { normalizeCrawlUrl } from "../url/normalize";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function extractLoc(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (value && typeof value === "object" && "loc" in value) {
    const loc = (value as { loc?: unknown }).loc;
    return typeof loc === "string" && loc.trim() ? loc.trim() : null;
  }

  return null;
}

export function parseSitemapXml(content: string, baseUrl: string): string[] {
  let parsed: unknown;

  try {
    parsed = parser.parse(content);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  const root = parsed as Record<string, unknown>;
  const urls = new Set<string>();

  if (root.urlset) {
    const urlset = root.urlset as { url?: unknown };
    for (const entry of asArray(urlset.url)) {
      const loc = extractLoc(entry);
      if (!loc) {
        continue;
      }

      const normalized = normalizeCrawlUrl(loc, baseUrl);
      if (normalized) {
        urls.add(normalized);
      }
    }
  }

  if (root.sitemapindex) {
    const index = root.sitemapindex as { sitemap?: unknown };
    for (const entry of asArray(index.sitemap)) {
      const loc = extractLoc(entry);
      if (!loc) {
        continue;
      }

      const normalized = normalizeCrawlUrl(loc, baseUrl);
      if (normalized) {
        urls.add(normalized);
      }
    }
  }

  return [...urls];
}

export function isSitemapIndex(content: string): boolean {
  try {
    const parsed = parser.parse(content) as Record<string, unknown>;
    return Boolean(parsed.sitemapindex);
  } catch {
    return false;
  }
}
