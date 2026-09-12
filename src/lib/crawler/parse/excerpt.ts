import * as cheerio from "cheerio";
import { normalizeWhitespace } from "./text";

export const MAIN_EXCERPT_MAX_CHARS = 1000;

const COOKIE_CONSENT_PATTERN =
  /cookie-banner|cookie-consent|consent-banner|cookieconsent|onetrust|cc-banner|gdpr-banner/;

const CHROME_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "nav",
  "footer",
  "iframe",
  "input",
  "textarea",
  "select",
  "[role=navigation]",
  "[role=contentinfo]",
].join(",");

function removeCookieConsent($: ReturnType<typeof cheerio.load>): void {
  $("[id], [class]").each((_, element) => {
    const id = ($(element).attr("id") ?? "").toLowerCase();
    const className = ($(element).attr("class") ?? "").toLowerCase();
    if (COOKIE_CONSENT_PATTERN.test(`${id} ${className}`)) {
      $(element).remove();
    }
  });
}

function selectMainRoot($: ReturnType<typeof cheerio.load>) {
  const candidates = [$("main").first(), $("article").first(), $("[role=main]").first()];

  for (const candidate of candidates) {
    if (candidate.length && normalizeWhitespace(candidate.text()).length > 0) {
      return candidate;
    }
  }

  const body = $("body").first();
  return body.length ? body : $.root();
}

export function boundExcerpt(text: string): string {
  if (text.length <= MAIN_EXCERPT_MAX_CHARS) {
    return text;
  }

  return text.slice(0, MAIN_EXCERPT_MAX_CHARS);
}

export function extractMainContentText(html: string): string {
  const $ = cheerio.load(html);
  $(CHROME_SELECTORS).remove();
  removeCookieConsent($);
  return normalizeWhitespace(selectMainRoot($).text());
}

export function extractMainExcerpt(html: string): string {
  return boundExcerpt(extractMainContentText(html));
}
