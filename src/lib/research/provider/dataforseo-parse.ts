import { RESEARCH_MAX_PARSE_ROWS } from "../config";
import { ResearchProviderError } from "../errors";
import type { ResearchCountry, ResearchLanguage } from "../types";
import type { RelatedKeywordIdeasResult } from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function firstTask(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload);
  const tasks = root?.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return null;
  }

  return asRecord(tasks[0]);
}

export function parseKeywordsForKeywordsResponse(payload: unknown): RelatedKeywordIdeasResult {
  const task = firstTask(payload);
  if (!task) {
    throw new ResearchProviderError("invalid_response", "DataForSEO task was missing.");
  }

  const statusCode = task.status_code;
  if (statusCode === 40202 || statusCode === 40204) {
    throw new ResearchProviderError("rate_limited", "DataForSEO quota or rate limit.", true);
  }

  if (typeof statusCode === "number" && statusCode >= 40000) {
    throw new ResearchProviderError("invalid_response", "DataForSEO task failed.");
  }

  const taskId = typeof task.id === "string" && task.id.trim() ? task.id.trim() : null;
  const providerCost =
    typeof task.cost === "number" && Number.isFinite(task.cost) ? task.cost : null;
  const result = Array.isArray(task.result) ? task.result : [];
  const ideas: RelatedKeywordIdeasResult["ideas"] = [];

  for (const [index, row] of result.slice(0, RESEARCH_MAX_PARSE_ROWS).entries()) {
    const record = asRecord(row);
    if (!record) {
      continue;
    }

    const keyword = typeof record.keyword === "string" ? record.keyword : "";
    const searchVolume =
      typeof record.search_volume === "number" && Number.isFinite(record.search_volume)
        ? Math.round(record.search_volume)
        : record.search_volume == null
          ? null
          : null;
    ideas.push({
      keyword,
      searchVolume,
      providerOrder: index,
    });
  }

  return { taskId, ideas, providerCost };
}

export function parseLocationsResponse(payload: unknown): ResearchCountry[] {
  const task = firstTask(payload);
  const result = Array.isArray(task?.result) ? task.result : [];
  const countries: ResearchCountry[] = [];
  const seen = new Set<string>();

  for (const row of result) {
    const record = asRecord(row);
    if (!record) {
      continue;
    }

    const locationType = typeof record.location_type === "string" ? record.location_type : "";
    if (locationType && locationType !== "Country") {
      continue;
    }

    const iso =
      typeof record.country_iso_code === "string"
        ? record.country_iso_code.trim().toUpperCase()
        : "";
    const name = typeof record.location_name === "string" ? record.location_name.trim() : "";
    const locationCode =
      typeof record.location_code === "number" && Number.isInteger(record.location_code)
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

  return countries.sort((left, right) => left.name.localeCompare(right.name, "en"));
}

export function parseLanguagesResponse(payload: unknown): ResearchLanguage[] {
  const task = firstTask(payload);
  const result = Array.isArray(task?.result) ? task.result : [];
  const languages: ResearchLanguage[] = [];
  const seen = new Set<string>();

  for (const row of result) {
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
