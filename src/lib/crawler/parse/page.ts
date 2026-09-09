import * as cheerio from "cheerio";
import type { FetchResult, ParsedPage } from "../types";
import { isSameSite, normalizeCrawlUrl } from "../url/normalize";

function extractJsonLdTypes(html: string): string[] {
  const $ = cheerio.load(html);
  const types = new Set<string>();

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).text().trim();
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      collectJsonLdTypes(parsed, types);
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  });

  return [...types];
}

function collectJsonLdTypes(value: unknown, types: Set<string>): void {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdTypes(item, types);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const typeValue = record["@type"];

  if (typeof typeValue === "string") {
    types.add(typeValue);
  } else if (Array.isArray(typeValue)) {
    for (const entry of typeValue) {
      if (typeof entry === "string") {
        types.add(entry);
      }
    }
  }

  if (record["@graph"]) {
    collectJsonLdTypes(record["@graph"], types);
  }
}

function countWords(text: string): number {
  const words = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  return words.length;
}

function getMetaContent(
  $: ReturnType<typeof cheerio.load>,
  selector: string,
): string | null {
  const value = $(selector).attr("content")?.trim();
  return value || null;
}

export function parseHtmlPage(
  fetchResult: FetchResult,
  siteHostname: string,
): ParsedPage {
  const $ = cheerio.load(fetchResult.body);
  const title = $("title").first().text().trim() || null;
  const metaDescription =
    getMetaContent($, 'meta[name="description"]') ??
    getMetaContent($, 'meta[property="og:description"]');
  const canonicalRaw = $('link[rel="canonical"]').attr("href")?.trim() ?? null;
  const canonical = canonicalRaw
    ? normalizeCrawlUrl(canonicalRaw, fetchResult.finalUrl)
    : null;
  const robotsMeta = getMetaContent($, 'meta[name="robots"]');
  const xRobotsTag = fetchResult.headers["x-robots-tag"] ?? null;
  const h1 = $("h1")
    .map((_, element) => $(element).text().trim())
    .get()
    .filter(Boolean);
  const h2 = $("h2")
    .map((_, element) => $(element).text().trim())
    .get()
    .filter(Boolean);
  const htmlLang = $("html").attr("lang")?.trim() || null;

  const internalLinks: Array<{ url: string; anchorText: string | null }> = [];
  const externalLinks: Array<{ url: string; anchorText: string | null }> = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")?.trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }

    const normalized = normalizeCrawlUrl(href, fetchResult.finalUrl);
    if (!normalized) {
      return;
    }

    const anchorText = $(element).text().replace(/\s+/g, " ").trim() || null;
    const target = { url: normalized, anchorText };

    if (isSameSite(normalized, siteHostname)) {
      internalLinks.push(target);
    } else {
      externalLinks.push(target);
    }
  });

  let imageCount = 0;
  let missingAltCount = 0;

  $("img").each((_, element) => {
    imageCount += 1;
    const alt = $(element).attr("alt");
    if (alt === undefined || alt.trim() === "") {
      missingAltCount += 1;
    }
  });

  const bodyText = $("body").text();
  const jsonLdTypes = extractJsonLdTypes(fetchResult.body);

  return {
    requestedUrl: fetchResult.requestedUrl,
    finalUrl: fetchResult.finalUrl,
    statusCode: fetchResult.statusCode,
    redirectChain: fetchResult.redirectChain,
    title,
    metaDescription,
    canonical,
    robotsMeta,
    xRobotsTag,
    h1,
    h2,
    htmlLang,
    internalLinks,
    externalLinks,
    imageCount,
    missingAltCount,
    jsonLdTypes,
    wordCount: countWords(bodyText),
  };
}
