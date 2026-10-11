import { RESEARCH_MAX_LANGUAGES_PER_RUN } from "./config";
import { ResearchGateError } from "./errors";
import type { ResearchLanguage } from "./types";

export function normalizeHtmlLang(tag: string): string | null {
  const trimmed = tag.trim().toLowerCase().replace(/_/g, "-");
  if (!trimmed) {
    return null;
  }

  const primary = trimmed.split("-")[0] ?? "";
  if (!/^[a-z]{2,3}$/.test(primary)) {
    return null;
  }

  return primary;
}

export function observedLanguageCodes(htmlLangs: string[] | undefined): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const tag of htmlLangs ?? []) {
    const code = normalizeHtmlLang(tag);
    if (!code || seen.has(code)) {
      continue;
    }

    seen.add(code);
    codes.push(code);
  }

  return codes;
}

export function researchLanguageCandidates(input: {
  htmlLangs: string[] | undefined;
  supported: ResearchLanguage[];
}): ResearchLanguage[] {
  const supportedByCode = new Map(input.supported.map((language) => [language.code, language]));
  const candidates: ResearchLanguage[] = [];
  for (const code of observedLanguageCodes(input.htmlLangs)) {
    const supported = supportedByCode.get(code);
    if (supported) {
      candidates.push(supported);
    }
  }

  return candidates;
}

export function selectResearchLanguages(input: {
  selected: string[] | undefined;
  candidates: ResearchLanguage[];
}): string[] {
  if (input.candidates.length === 0) {
    throw new ResearchGateError(
      "unsupported_language",
      "Foundfy needs a supported site language before researching related demand.",
    );
  }

  if (!input.selected || input.selected.length === 0) {
    throw new ResearchGateError(
      "no_research_language",
      "Choose the site languages you want Foundfy to research.",
      400,
    );
  }

  const allowed = new Set(input.candidates.map((language) => language.code));
  const chosen: string[] = [];
  const seen = new Set<string>();
  for (const value of input.selected) {
    const code = normalizeHtmlLang(value);
    if (!code || !allowed.has(code)) {
      throw new ResearchGateError(
        "unsupported_language",
        "Choose a language Foundfy observed on this site.",
        400,
      );
    }

    if (seen.has(code)) {
      continue;
    }

    seen.add(code);
    chosen.push(code);
  }

  if (chosen.length === 0) {
    throw new ResearchGateError(
      "no_research_language",
      "Choose the site languages you want Foundfy to research.",
      400,
    );
  }

  if (chosen.length > RESEARCH_MAX_LANGUAGES_PER_RUN) {
    throw new ResearchGateError(
      "unsupported_language",
      "Choose up to 3 languages to research.",
      400,
    );
  }

  return chosen;
}
