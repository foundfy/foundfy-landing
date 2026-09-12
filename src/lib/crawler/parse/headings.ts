import * as cheerio from "cheerio";
import { normalizeWhitespace } from "./text";

export const MAX_HEADINGS_PER_LEVEL = 15;

const CHROME_HEADING_TEXTS = new Set([
  "main navigation",
  "navigation",
  "menu",
  "primary navigation",
  "footer",
  "sidebar",
  "categories",
  "category",
  "cookie notice",
  "cookie consent",
  "skip to content",
  "skip to main content",
]);

const CHROME_ANCESTOR_SELECTOR =
  "nav, footer, aside, [role=navigation], [role=contentinfo], [role=complementary]";

export function extractBoundedHeadings(
  $: ReturnType<typeof cheerio.load>,
  level: 2 | 3,
): string[] {
  const headings: string[] = [];
  const seen = new Set<string>();
  const selector = level === 2 ? "h2" : "h3";

  $(selector).each((_, element) => {
    if (headings.length >= MAX_HEADINGS_PER_LEVEL) {
      return false;
    }

    const text = normalizeWhitespace($(element).text());
    if (!text || text.length < 2 || text.length > 200) {
      return;
    }

    if (
      CHROME_HEADING_TEXTS.has(text.toLowerCase()) ||
      $(element).closest(CHROME_ANCESTOR_SELECTOR).length > 0
    ) {
      return;
    }

    const key = text.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    headings.push(text);
  });

  return headings;
}
