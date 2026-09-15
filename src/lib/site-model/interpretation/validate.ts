import type { SiteInterpretationFields, SiteModelUnderstanding } from "../types";
import { collectSiteModelEvidenceText, isGroundedInEvidence } from "./evidence-text";
import { normalizeInterpretationFields } from "./parse";

const BLOCKED_CLAIM_PATTERN =
  /\b(rank(?:ing)?s?|keyword(?:s)?|search volume|impressions?|clicks?|gsc|google search console|ga4|analytics|serp|backlinks?|domain authority|recommended? (?:fix|action)|optimize|meta description)\b/i;

export function validateInterpretationAgainstEvidence(input: {
  fields: SiteInterpretationFields;
  understanding: SiteModelUnderstanding;
}): { ok: true; fields: SiteInterpretationFields } | { ok: false; reason: string } {
  const fields = normalizeInterpretationFields(input.fields);

  if (!fields.siteDescription) {
    return { ok: false, reason: "A site description is required." };
  }

  if (BLOCKED_CLAIM_PATTERN.test(fields.siteDescription)) {
    return { ok: false, reason: "Interpretation included search-performance or SEO-recommendation language." };
  }

  const evidenceText = collectSiteModelEvidenceText(input.understanding);
  if (!isGroundedInEvidence(fields.siteDescription, evidenceText)) {
    return { ok: false, reason: "Site description is not grounded in the Site Model evidence." };
  }

  for (const listName of ["offers", "audiences", "locations"] as const) {
    for (const item of fields[listName]) {
      if (BLOCKED_CLAIM_PATTERN.test(item)) {
        return { ok: false, reason: `${listName} included search-performance or SEO-recommendation language.` };
      }

      if (!isGroundedInEvidence(item, evidenceText)) {
        return { ok: false, reason: `${listName} included a claim that is not grounded in the Site Model evidence.` };
      }
    }
  }

  if (input.understanding.pages.length <= 2 && fields.audiences.length > 0) {
    return {
      ok: false,
      reason: "Audience claims are not allowed from a two-page-or-smaller sample.",
    };
  }

  if (
    input.understanding.languages.urlLocales.length === 0 &&
    input.understanding.jsonLdTypes.every((type) => !/place|postal|address|geo|country/i.test(type)) &&
    fields.locations.length > 0
  ) {
    return {
      ok: false,
      reason: "Locations were not supported by URL locale or structured data.",
    };
  }

  return { ok: true, fields };
}
