import { isHomepageUrl } from "@/lib/analysis/search-presence";
import { classifyPagePath } from "@/lib/crawler/select/page-priority";
import { GOOGLE_INDEXING_MAX_URLS } from "./config";
import { stripWww } from "./match";
import type { GoogleIndexingUrlRole } from "@/lib/foundations/types";

export type IndexingPageCandidate = {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number | null;
};

export function normalizeInspectionUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (!parsed.hostname) {
    return null;
  }

  parsed.hash = "";
  if (!parsed.pathname) {
    parsed.pathname = "/";
  }

  return parsed.toString();
}

export function urlBelongsToFoundfyWebsite(
  url: string,
  website: { hostname: string },
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return stripWww(parsed.hostname) === stripWww(website.hostname);
}

export function urlContainedInGscProperty(url: string, propertyUri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const property = propertyUri.trim();
  if (property.toLowerCase().startsWith("sc-domain:")) {
    const domain = stripWww(property.slice("sc-domain:".length));
    if (!domain) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`) || stripWww(host) === domain;
  }

  try {
    const prefix = new URL(property);
    return parsed.toString().startsWith(prefix.toString());
  } catch {
    return false;
  }
}

export function canInspectUrl(
  url: string,
  website: { hostname: string },
  propertyUri: string,
): boolean {
  return urlBelongsToFoundfyWebsite(url, website) && urlContainedInGscProperty(url, propertyUri);
}

function inspectionUrlFromPage(page: IndexingPageCandidate): string | null {
  return normalizeInspectionUrl(page.finalUrl || page.requestedUrl);
}

function roleForUrl(url: string, hostname: string): GoogleIndexingUrlRole {
  return isHomepageUrl(url, hostname) ? "homepage" : "important_page";
}

function isImportantFetchedUrl(url: string, hostname: string): boolean {
  if (isHomepageUrl(url, hostname)) {
    return true;
  }

  const pathClass = classifyPagePath(url);
  return pathClass === "homepage" || pathClass === "identity" || pathClass === "locale_home";
}

export function selectInspectionUrls(input: {
  pages: IndexingPageCandidate[];
  website: { hostname: string };
  propertyUri: string;
  limit?: number;
}): Array<{ url: string; role: GoogleIndexingUrlRole }> {
  const limit = input.limit ?? GOOGLE_INDEXING_MAX_URLS;
  const selected: Array<{ url: string; role: GoogleIndexingUrlRole }> = [];
  const seen = new Set<string>();

  function consider(page: IndexingPageCandidate): void {
    if (selected.length >= limit) {
      return;
    }

    const url = inspectionUrlFromPage(page);
    if (!url || seen.has(url)) {
      return;
    }

    if (!canInspectUrl(url, input.website, input.propertyUri)) {
      return;
    }

    if (!isImportantFetchedUrl(url, input.website.hostname)) {
      return;
    }

    seen.add(url);
    selected.push({ url, role: roleForUrl(url, input.website.hostname) });
  }

  const homepage = input.pages.find((page) => {
    const url = inspectionUrlFromPage(page);
    return Boolean(url && isHomepageUrl(url, input.website.hostname));
  });
  if (homepage) {
    consider(homepage);
  }

  const others = input.pages
    .filter((page) => page !== homepage)
    .slice()
    .sort((left, right) => {
      const leftOk = left.statusCode === 200 ? 0 : 1;
      const rightOk = right.statusCode === 200 ? 0 : 1;
      if (leftOk !== rightOk) {
        return leftOk - rightOk;
      }
      return (left.finalUrl || left.requestedUrl).localeCompare(
        right.finalUrl || right.requestedUrl,
      );
    });

  for (const page of others) {
    consider(page);
  }

  return selected;
}
