import { foldPathSegment } from "./text";

const LOCALE_SEGMENTS = new Set([
  "ar",
  "bg",
  "bn",
  "ca",
  "cs",
  "da",
  "de",
  "de-at",
  "de-ch",
  "de-de",
  "el",
  "en",
  "en-au",
  "en-gb",
  "en-us",
  "es",
  "es-es",
  "es-mx",
  "et",
  "fa",
  "fi",
  "fil",
  "fr",
  "fr-ca",
  "he",
  "hi",
  "hr",
  "hu",
  "id",
  "it",
  "ja",
  "ko",
  "lt",
  "lv",
  "ms",
  "nb",
  "nl",
  "nn",
  "no",
  "pl",
  "pt",
  "pt-br",
  "pt-pt",
  "ro",
  "ru",
  "sk",
  "sl",
  "sr",
  "sv",
  "th",
  "tr",
  "uk",
  "vi",
  "zh",
  "zh-cn",
  "zh-hk",
  "zh-tw",
]);

export function isLocalePathSegment(segment: string): boolean {
  return LOCALE_SEGMENTS.has(foldPathSegment(segment));
}

export function extractUrlLocale(url: string): string | null {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const first = segments[0];
    if (!first) {
      return null;
    }

    const folded = foldPathSegment(first);
    return LOCALE_SEGMENTS.has(folded) ? folded : null;
  } catch {
    return null;
  }
}
