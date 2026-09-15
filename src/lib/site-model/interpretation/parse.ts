import type {
  SiteConfirmedUnderstanding,
  SiteInterpretationDraft,
  SiteInterpretationFields,
  SiteInterpretationGenerator,
} from "../types";

const MAX_DESCRIPTION_CHARS = 600;
const MAX_LIST_ITEM_CHARS = 160;
const MAX_LIST_ITEMS = 8;

function isGenerator(value: unknown): value is SiteInterpretationGenerator {
  return value === "heuristic" || value === "openai";
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: string[] = [];
  for (const entry of value) {
    const text = asTrimmedString(entry);
    if (!text) {
      continue;
    }

    items.push(text.slice(0, MAX_LIST_ITEM_CHARS));
    if (items.length >= MAX_LIST_ITEMS) {
      break;
    }
  }

  return items;
}

export function parseSiteInterpretationDraft(
  value: unknown,
): SiteInterpretationDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const siteDescription = asTrimmedString(record.siteDescription);
  const evidenceHash = asTrimmedString(record.evidenceHash);
  const sourceCrawlRunId = asTrimmedString(record.sourceCrawlRunId);
  const generatedAt = asTrimmedString(record.generatedAt);
  const promptVersion = asTrimmedString(record.promptVersion);

  if (
    !siteDescription ||
    !evidenceHash ||
    !sourceCrawlRunId ||
    !generatedAt ||
    !promptVersion ||
    !isGenerator(record.generator)
  ) {
    return null;
  }

  const status = record.status === "failed" ? "failed" : "ready";

  return {
    promptVersion,
    generatedAt,
    generator: record.generator,
    status,
    evidenceHash,
    sourceCrawlRunId,
    siteDescription: siteDescription.slice(0, MAX_DESCRIPTION_CHARS),
    offers: asStringList(record.offers),
    audiences: asStringList(record.audiences),
    locations: asStringList(record.locations),
    uncertainty: asStringList(record.uncertainty),
  };
}

export function parseSiteConfirmedUnderstanding(
  value: unknown,
): SiteConfirmedUnderstanding | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const siteDescription = asTrimmedString(record.siteDescription);
  const evidenceHash = asTrimmedString(record.evidenceHash);
  const sourceCrawlRunId = asTrimmedString(record.sourceCrawlRunId);
  const confirmedAt = asTrimmedString(record.confirmedAt);
  const sourceInterpretationGeneratedAt = asTrimmedString(
    record.sourceInterpretationGeneratedAt,
  );

  if (
    !siteDescription ||
    !evidenceHash ||
    !sourceCrawlRunId ||
    !confirmedAt ||
    !sourceInterpretationGeneratedAt ||
    !isGenerator(record.sourceGenerator)
  ) {
    return null;
  }

  return {
    confirmedAt,
    sourceInterpretationGeneratedAt,
    sourceGenerator: record.sourceGenerator,
    evidenceHash,
    sourceCrawlRunId,
    siteDescription: siteDescription.slice(0, MAX_DESCRIPTION_CHARS),
    offers: asStringList(record.offers),
    audiences: asStringList(record.audiences),
    locations: asStringList(record.locations),
  };
}

export function normalizeInterpretationFields(
  input: SiteInterpretationFields,
): SiteInterpretationFields {
  const siteDescription = input.siteDescription.trim().slice(0, MAX_DESCRIPTION_CHARS);

  return {
    siteDescription,
    offers: asStringList(input.offers),
    audiences: asStringList(input.audiences),
    locations: asStringList(input.locations),
  };
}

export function fieldsFromInterpretation(
  draft: SiteInterpretationDraft,
): SiteInterpretationFields {
  return {
    siteDescription: draft.siteDescription,
    offers: draft.offers,
    audiences: draft.audiences,
    locations: draft.locations,
  };
}

export function fieldsFromConfirmed(
  confirmed: SiteConfirmedUnderstanding,
): SiteInterpretationFields {
  return {
    siteDescription: confirmed.siteDescription,
    offers: confirmed.offers,
    audiences: confirmed.audiences,
    locations: confirmed.locations,
  };
}
