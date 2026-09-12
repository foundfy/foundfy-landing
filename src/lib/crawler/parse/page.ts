import * as cheerio from "cheerio";
import type { FetchResult, ParsedPage } from "../types";
import { isSameSite, normalizeCrawlUrl } from "../url/normalize";
import { hashNormalizedContent } from "./content-hash";
import { extractMainContentText, extractMainExcerpt } from "./excerpt";
import { extractBoundedHeadings } from "./headings";
import { extractJsonLdProperties, extractJsonLdTypes } from "./json-ld";
import { collectNavigationHrefs, extractNavLabels } from "./nav-labels";
import { extractUrlLocale } from "./url-locale";

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
  const h2 = extractBoundedHeadings($, 2);
  const h3 = extractBoundedHeadings($, 3);
  const htmlLang = $("html").attr("lang")?.trim() || null;
  const navLabels = extractNavLabels($);

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

  const navigationUrls = [
    ...new Set(
      collectNavigationHrefs($)
        .map((href) => normalizeCrawlUrl(href, fetchResult.finalUrl))
        .filter((url): url is string => url !== null)
        .filter((url) => isSameSite(url, siteHostname)),
    ),
  ];

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
  const jsonLdProperties = extractJsonLdProperties(fetchResult.body);
  const normalizedMainText = extractMainContentText(fetchResult.body);
  const mainExcerpt = extractMainExcerpt(fetchResult.body);
  const contentHash = hashNormalizedContent(normalizedMainText);

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
    h3,
    htmlLang,
    urlLocale: extractUrlLocale(fetchResult.finalUrl),
    navLabels,
    navigationUrls,
    mainExcerpt,
    contentHash,
    internalLinks,
    externalLinks,
    imageCount,
    missingAltCount,
    jsonLdTypes,
    jsonLdProperties,
    wordCount: countWords(bodyText),
  };
}
