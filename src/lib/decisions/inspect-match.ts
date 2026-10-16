import { opportunityCompactKey, opportunityQueryKey } from "@/lib/opportunities/normalize";
import { normalizeHtmlLang } from "@/lib/research/languages";
import { RESEARCH_INSPECT_STATES, type ResearchInspectState } from "./types";

export const RELATED_DEMAND_INSPECT_STATES = RESEARCH_INSPECT_STATES;
export type RelatedDemandInspectState = ResearchInspectState;

export type InspectPageEvidence = {
  id: string;
  requestedUrl: string;
  finalUrl: string;
  title: string | null;
  h1: string[];
  metaDescription: string | null;
  excerpt: string | null;
  htmlLang: string | null;
  urlLocale: string | null;
  canonical: string | null;
};

export type InspectPageStrength = "strong" | "weak" | "none";

export type LanguageScope = "match" | "mismatch" | "conflict";

export function inspectLanguageScope(
  page: Pick<InspectPageEvidence, "htmlLang" | "urlLocale">,
  ideaLanguage: string,
): LanguageScope {
  const idea = normalizeHtmlLang(ideaLanguage);
  if (!idea) {
    return "mismatch";
  }

  const html = page.htmlLang ? normalizeHtmlLang(page.htmlLang) : null;
  const locale = page.urlLocale ? normalizeHtmlLang(page.urlLocale) : null;

  if (html && locale && html !== locale) {
    return "conflict";
  }

  if (html === idea || locale === idea) {
    return "match";
  }

  return "mismatch";
}

function normalizedHaystack(value: string): string {
  return value.normalize("NFC").toLowerCase();
}

function fieldHasExactOrCompactMatch(value: string | null | undefined, phrase: string): boolean {
  if (!value) {
    return false;
  }

  const hay = normalizedHaystack(value);
  const needle = normalizedHaystack(phrase);
  if (needle && hay.includes(needle)) {
    return true;
  }

  const compact = opportunityCompactKey(phrase);
  if (!compact) {
    return false;
  }

  return opportunityCompactKey(value) === compact || opportunityQueryKey(value) === opportunityQueryKey(phrase);
}

export function inspectPageStrength(page: InspectPageEvidence, phrase: string): InspectPageStrength {
  const strongFields = [page.title, page.metaDescription, ...(page.h1 ?? [])];
  if (strongFields.some((field) => fieldHasExactOrCompactMatch(field, phrase))) {
    return "strong";
  }

  if (fieldHasExactOrCompactMatch(page.excerpt, phrase)) {
    return "weak";
  }

  return "none";
}

export function inspectRelatedDemandPages(input: {
  phrase: string;
  languageCode: string;
  pages: InspectPageEvidence[];
}): {
  state: RelatedDemandInspectState;
  candidatePages: InspectPageEvidence[];
  languageConflicts: boolean;
} {
  const matching: InspectPageEvidence[] = [];
  const strong: InspectPageEvidence[] = [];
  const weak: InspectPageEvidence[] = [];
  let languageConflicts = false;

  for (const page of input.pages) {
    const scope = inspectLanguageScope(page, input.languageCode);
    if (scope === "conflict") {
      languageConflicts = true;
      const strength = inspectPageStrength(page, input.phrase);
      if (strength !== "none") {
        matching.push(page);
        weak.push(page);
      }
      continue;
    }

    if (scope !== "match") {
      continue;
    }

    const strength = inspectPageStrength(page, input.phrase);
    if (strength === "none") {
      continue;
    }

    matching.push(page);
    if (strength === "strong") {
      strong.push(page);
    } else {
      weak.push(page);
    }
  }

  if (strong.length === 1 && weak.length === 0 && !languageConflicts) {
    return {
      state: "clear_existing_page_evidence",
      candidatePages: strong,
      languageConflicts,
    };
  }

  if (strong.length === 0 && weak.length === 0 && !languageConflicts) {
    return {
      state: "no_obvious_match_in_current_crawl",
      candidatePages: [],
      languageConflicts,
    };
  }

  return {
    state: "ambiguous",
    candidatePages: strong.length > 0 ? strong : matching,
    languageConflicts,
  };
}
