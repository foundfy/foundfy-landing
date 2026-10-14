import { RESEARCH_MAX_PARSE_ROWS } from "../config";
import { ResearchProviderError } from "../errors";
import type { ResearchCountry, ResearchLanguage } from "../types";
import { logDataForSeoMetadata } from "./dataforseo-diagnostics";
import type { RelatedKeywordIdeasResult } from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function throwIfDataForSeoStatus(statusCode: unknown): void {
  if (statusCode === 40202 || statusCode === 40204) {
    throw new ResearchProviderError("rate_limited", "DataForSEO quota or rate limit.", true);
  }

  if (typeof statusCode === "number" && statusCode >= 40000) {
    throw new ResearchProviderError("invalid_response", "DataForSEO task failed.");
  }
}

function numericStatus(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function failMetadata(
  category: "locations" | "languages",
  error: ResearchProviderError,
  extra?: {
    topLevelStatusCode?: number | null;
    taskStatusCode?: number | null;
    resultCount?: number;
    parsedCount?: number;
  },
): never {
  logDataForSeoMetadata({
    category,
    stage: "failed",
    errorCode: error.code,
    ...extra,
  });
  throw error;
}

function readDataForSeoMetadataResult(
  payload: unknown,
  category: "locations" | "languages",
): {
  topLevelStatusCode: number | null;
  taskStatusCode: number | null;
  result: unknown[];
} {
  const root = asRecord(payload);
  if (!root) {
    failMetadata(
      category,
      new ResearchProviderError("invalid_response", "DataForSEO metadata response was invalid."),
    );
  }

  const topLevelStatusCode = numericStatus(root.status_code);
  try {
    throwIfDataForSeoStatus(root.status_code);
  } catch (error) {
    if (error instanceof ResearchProviderError) {
      failMetadata(category, error, { topLevelStatusCode });
    }
    throw error;
  }

  if (!("tasks" in root) || root.tasks == null) {
    failMetadata(
      category,
      new ResearchProviderError("invalid_response", "DataForSEO task was missing."),
      { topLevelStatusCode },
    );
  }

  if (!Array.isArray(root.tasks)) {
    failMetadata(
      category,
      new ResearchProviderError("invalid_response", "DataForSEO metadata response was invalid."),
      { topLevelStatusCode },
    );
  }

  if (root.tasks.length === 0) {
    failMetadata(
      category,
      new ResearchProviderError("invalid_response", "DataForSEO task was missing."),
      { topLevelStatusCode },
    );
  }

  const task = asRecord(root.tasks[0]);
  if (!task) {
    failMetadata(
      category,
      new ResearchProviderError("invalid_response", "DataForSEO task was missing."),
      { topLevelStatusCode },
    );
  }

  const taskStatusCode = numericStatus(task.status_code);
  try {
    throwIfDataForSeoStatus(task.status_code);
  } catch (error) {
    if (error instanceof ResearchProviderError) {
      failMetadata(category, error, { topLevelStatusCode, taskStatusCode });
    }
    throw error;
  }

  if (!("result" in task) || task.result == null) {
    failMetadata(
      category,
      new ResearchProviderError("invalid_response", "DataForSEO metadata result was missing."),
      { topLevelStatusCode, taskStatusCode },
    );
  }

  if (!Array.isArray(task.result)) {
    failMetadata(
      category,
      new ResearchProviderError("invalid_response", "DataForSEO metadata result was invalid."),
      { topLevelStatusCode, taskStatusCode },
    );
  }

  if (task.result.length === 0) {
    failMetadata(
      category,
      new ResearchProviderError("invalid_response", "DataForSEO metadata result was empty."),
      { topLevelStatusCode, taskStatusCode, resultCount: 0 },
    );
  }

  return {
    topLevelStatusCode,
    taskStatusCode,
    result: task.result,
  };
}

function isCountryLocationType(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "country";
}

function readKeywordsForKeywordsResult(payload: unknown): {
  task: Record<string, unknown>;
  result: unknown[];
} {
  const root = asRecord(payload);
  if (!root) {
    throw new ResearchProviderError("invalid_response", "DataForSEO keyword response was invalid.");
  }

  throwIfDataForSeoStatus(root.status_code);

  if (!("tasks" in root) || root.tasks == null) {
    throw new ResearchProviderError("invalid_response", "DataForSEO task was missing.");
  }

  if (!Array.isArray(root.tasks)) {
    throw new ResearchProviderError("invalid_response", "DataForSEO keyword response was invalid.");
  }

  if (root.tasks.length === 0) {
    throw new ResearchProviderError("invalid_response", "DataForSEO task was missing.");
  }

  const task = asRecord(root.tasks[0]);
  if (!task) {
    throw new ResearchProviderError("invalid_response", "DataForSEO task was missing.");
  }

  throwIfDataForSeoStatus(task.status_code);

  if (!("result" in task) || task.result == null) {
    throw new ResearchProviderError("invalid_response", "DataForSEO keyword result was missing.");
  }

  if (!Array.isArray(task.result)) {
    throw new ResearchProviderError("invalid_response", "DataForSEO keyword result was invalid.");
  }

  return { task, result: task.result };
}

export function parseKeywordsForKeywordsResponse(payload: unknown): RelatedKeywordIdeasResult {
  const envelope = readKeywordsForKeywordsResult(payload);
  const taskId =
    typeof envelope.task.id === "string" && envelope.task.id.trim() ? envelope.task.id.trim() : null;
  const providerCost =
    typeof envelope.task.cost === "number" && Number.isFinite(envelope.task.cost)
      ? envelope.task.cost
      : null;
  const ideas: RelatedKeywordIdeasResult["ideas"] = [];

  for (const [index, row] of envelope.result.slice(0, RESEARCH_MAX_PARSE_ROWS).entries()) {
    const record = asRecord(row);
    if (!record || typeof record.keyword !== "string") {
      throw new ResearchProviderError(
        "invalid_response",
        "DataForSEO keyword result was invalid.",
      );
    }

    const searchVolume =
      typeof record.search_volume === "number" && Number.isFinite(record.search_volume)
        ? Math.round(record.search_volume)
        : null;
    ideas.push({
      keyword: record.keyword,
      searchVolume,
      providerOrder: index,
    });
  }

  return { taskId, ideas, providerCost, providerResultCount: ideas.length };
}

export function parseLocationsResponse(payload: unknown): ResearchCountry[] {
  const envelope = readDataForSeoMetadataResult(payload, "locations");
  const countries: ResearchCountry[] = [];
  const seen = new Set<string>();

  for (const row of envelope.result) {
    const record = asRecord(row);
    if (!record) {
      continue;
    }

    if (!isCountryLocationType(record.location_type)) {
      continue;
    }

    const iso =
      typeof record.country_iso_code === "string"
        ? record.country_iso_code.trim().toUpperCase()
        : "";
    const name = typeof record.location_name === "string" ? record.location_name.trim() : "";
    const locationCode =
      typeof record.location_code === "number" &&
      Number.isInteger(record.location_code) &&
      record.location_code > 0
        ? record.location_code
        : null;
    if (!iso || iso.length !== 2 || !name || locationCode == null) {
      continue;
    }

    if (seen.has(iso)) {
      continue;
    }

    seen.add(iso);
    countries.push({ key: iso, name, locationCode });
  }

  if (countries.length === 0) {
    failMetadata(
      "locations",
      new ResearchProviderError("invalid_response", "DataForSEO location metadata was unusable."),
      {
        topLevelStatusCode: envelope.topLevelStatusCode,
        taskStatusCode: envelope.taskStatusCode,
        resultCount: envelope.result.length,
        parsedCount: 0,
      },
    );
  }

  logDataForSeoMetadata({
    category: "locations",
    stage: "parsed",
    topLevelStatusCode: envelope.topLevelStatusCode,
    taskStatusCode: envelope.taskStatusCode,
    resultCount: envelope.result.length,
    parsedCount: countries.length,
  });

  return countries.sort((left, right) => left.name.localeCompare(right.name, "en"));
}

export function parseLanguagesResponse(payload: unknown): ResearchLanguage[] {
  const envelope = readDataForSeoMetadataResult(payload, "languages");
  const languages: ResearchLanguage[] = [];
  const seen = new Set<string>();

  for (const row of envelope.result) {
    const record = asRecord(row);
    if (!record) {
      continue;
    }

    const code =
      typeof record.language_code === "string" ? record.language_code.trim().toLowerCase() : "";
    const name = typeof record.language_name === "string" ? record.language_name.trim() : code;
    if (!/^[a-z]{2,3}$/.test(code) || seen.has(code)) {
      continue;
    }

    seen.add(code);
    languages.push({ code, name: name || code });
  }

  if (languages.length === 0) {
    failMetadata(
      "languages",
      new ResearchProviderError("invalid_response", "DataForSEO language metadata was unusable."),
      {
        topLevelStatusCode: envelope.topLevelStatusCode,
        taskStatusCode: envelope.taskStatusCode,
        resultCount: envelope.result.length,
        parsedCount: 0,
      },
    );
  }

  logDataForSeoMetadata({
    category: "languages",
    stage: "parsed",
    topLevelStatusCode: envelope.topLevelStatusCode,
    taskStatusCode: envelope.taskStatusCode,
    resultCount: envelope.result.length,
    parsedCount: languages.length,
  });

  return languages;
}

export function buildKeywordsForKeywordsTask(input: {
  offering: string;
  locationCode: number;
  languageCode: string;
}): Record<string, unknown> {
  return {
    keywords: [input.offering],
    location_code: input.locationCode,
    language_code: input.languageCode,
    search_partners: false,
    sort_by: "search_volume",
  };
}
