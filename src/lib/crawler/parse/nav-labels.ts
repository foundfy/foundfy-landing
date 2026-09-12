import * as cheerio from "cheerio";
import { normalizeWhitespace } from "./text";

export const MAX_NAV_LABELS = 30;

const NAV_SELECTOR = "nav, [role=navigation]";

export function extractNavLabels($: ReturnType<typeof cheerio.load>): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  $(NAV_SELECTOR)
    .find("a")
    .each((_, element) => {
      if (labels.length >= MAX_NAV_LABELS) {
        return false;
      }

      const text = normalizeWhitespace($(element).text());
      if (!text || text.length > 80) {
        return;
      }

      const key = text.toLowerCase();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      labels.push(text);
    });

  return labels;
}

export function collectNavigationHrefs($: ReturnType<typeof cheerio.load>): string[] {
  const hrefs: string[] = [];

  $(NAV_SELECTOR)
    .find("a[href]")
    .each((_, element) => {
      const href = $(element).attr("href")?.trim();
      if (href) {
        hrefs.push(href);
      }
    });

  return hrefs;
}
