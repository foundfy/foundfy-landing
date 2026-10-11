import {
  isClearlyBrandedQuery,
  opportunityCompactKey,
} from "@/lib/opportunities/normalize";
import { RESEARCH_MAX_OFFERINGS_PER_RUN } from "./config";
import { ResearchGateError } from "./errors";

const GENERIC_OFFERING_COMPACT = new Set([
  "service",
  "services",
  "product",
  "products",
  "solution",
  "solutions",
]);

export function trimOffering(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function hasDisallowedOfferingCharacters(value: string): boolean {
  return /\p{Extended_Pictographic}/u.test(value) || /[\u0000-\u001F\u007F]/.test(value);
}

export function offeringQualityReason(
  offering: string,
  hostname: string,
): string | null {
  const trimmed = trimOffering(offering);
  if (!trimmed) {
    return "empty";
  }

  if (trimmed.length > 80) {
    return "too_long";
  }

  const compact = opportunityCompactKey(trimmed);
  if (compact.length < 4) {
    return "too_short";
  }

  if (GENERIC_OFFERING_COMPACT.has(compact)) {
    return "generic";
  }

  if (isClearlyBrandedQuery(trimmed, hostname)) {
    return "brand_only";
  }

  if (hasDisallowedOfferingCharacters(trimmed)) {
    return "invalid_characters";
  }

  return null;
}

export function isValidResearchOffering(offering: string, hostname: string): boolean {
  return offeringQualityReason(offering, hostname) === null;
}

export function validConfirmedOfferings(
  offers: string[] | undefined,
  hostname: string,
): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const offer of offers ?? []) {
    const trimmed = trimOffering(offer);
    if (!isValidResearchOffering(trimmed, hostname)) {
      continue;
    }

    const compact = opportunityCompactKey(trimmed);
    if (seen.has(compact)) {
      continue;
    }

    seen.add(compact);
    valid.push(trimmed);
  }

  return valid;
}

export function selectResearchOfferings(input: {
  confirmedValid: string[];
  selected: string[] | undefined;
}): string[] {
  const { confirmedValid, selected } = input;
  if (confirmedValid.length === 0) {
    throw new ResearchGateError(
      "no_valid_offering",
      "Foundfy needs a clearer confirmed offering before researching related demand.",
    );
  }

  const confirmedSet = new Set(confirmedValid);
  if (selected === undefined) {
    if (confirmedValid.length > RESEARCH_MAX_OFFERINGS_PER_RUN) {
      throw new ResearchGateError(
        "offering_selection_required",
        "Choose up to 5 confirmed offerings to research.",
        400,
      );
    }

    return confirmedValid;
  }

  const chosen: string[] = [];
  const seen = new Set<string>();
  for (const value of selected) {
    const trimmed = trimOffering(value);
    if (!confirmedSet.has(trimmed)) {
      throw new ResearchGateError(
        "invalid_offering_selection",
        "Research offerings must match currently confirmed offerings.",
        400,
      );
    }

    if (seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    chosen.push(trimmed);
  }

  if (chosen.length === 0) {
    throw new ResearchGateError(
      "no_valid_offering",
      "Foundfy needs a clearer confirmed offering before researching related demand.",
    );
  }

  if (chosen.length > RESEARCH_MAX_OFFERINGS_PER_RUN) {
    throw new ResearchGateError(
      "offering_selection_required",
      "Choose up to 5 confirmed offerings to research.",
      400,
    );
  }

  return chosen;
}
