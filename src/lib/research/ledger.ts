import { RESEARCH_MAX_REQUESTS_PER_RUN } from "./config";
import {
  isResearchRequestKey,
  requestKeyMatchesPair,
  researchRequestKey,
} from "./request-key";
import { parseFilterReasonCounts } from "./filter-reasons";
import {
  RESEARCH_REQUEST_STATUSES,
  type ResearchRequestLedgerEntry,
  type ResearchRequestStatus,
} from "./types";

const LEDGER_KEYS = [
  "requestKey",
  "seedOffering",
  "languageCode",
  "locationCode",
  "providerTaskId",
  "status",
  "requestedAt",
  "attemptedAt",
  "retrievedAt",
  "ideaCount",
  "providerResultCount",
  "filterReasonCounts",
  "providerCost",
  "failureCode",
] as const;

const ATTEMPTED_STATUSES: ResearchRequestStatus[] = [
  "in_flight",
  "succeeded",
  "zero_results",
  "failed",
  "timeout",
  "rate_limited",
];

function asTrimmedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) {
    return null;
  }

  return trimmed;
}

function asNullableString(value: unknown, max: number): string | null {
  if (value == null) {
    return null;
  }

  return asTrimmedString(value, max);
}

export function parseRequestLedger(value: unknown): ResearchRequestLedgerEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries: ResearchRequestLedgerEntry[] = [];
  for (const item of value.slice(0, RESEARCH_MAX_REQUESTS_PER_RUN)) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const status = record.status;
    if (
      typeof status !== "string" ||
      !RESEARCH_REQUEST_STATUSES.includes(status as ResearchRequestStatus)
    ) {
      continue;
    }

    const seedOffering = asTrimmedString(record.seedOffering, 80);
    const languageCode = asTrimmedString(record.languageCode, 8);
    const requestedAt = asTrimmedString(record.requestedAt, 40);
    if (!seedOffering || !languageCode || !requestedAt) {
      continue;
    }

    const locationCode =
      typeof record.locationCode === "number" && Number.isInteger(record.locationCode)
        ? record.locationCode
        : null;
    if (locationCode == null) {
      continue;
    }

    const ideaCount =
      typeof record.ideaCount === "number" && Number.isInteger(record.ideaCount) && record.ideaCount >= 0
        ? record.ideaCount
        : 0;
    const providerResultCount =
      typeof record.providerResultCount === "number" &&
      Number.isInteger(record.providerResultCount) &&
      record.providerResultCount >= 0
        ? record.providerResultCount
        : null;
    const providerCost =
      typeof record.providerCost === "number" &&
      Number.isFinite(record.providerCost) &&
      record.providerCost >= 0
        ? record.providerCost
        : null;

    const requestKey = isResearchRequestKey(record.requestKey)
      ? record.requestKey
      : researchRequestKey(seedOffering, languageCode);

    entries.push({
      requestKey,
      seedOffering,
      languageCode,
      locationCode,
      providerTaskId: asNullableString(record.providerTaskId, 80),
      status: status as ResearchRequestStatus,
      requestedAt,
      attemptedAt: asNullableString(record.attemptedAt, 40),
      retrievedAt: asNullableString(record.retrievedAt, 40),
      ideaCount,
      providerResultCount,
      filterReasonCounts: parseFilterReasonCounts(record.filterReasonCounts),
      providerCost,
      failureCode: asNullableString(record.failureCode, 80),
    });
  }

  return entries;
}

export function serializeRequestLedger(
  entries: ResearchRequestLedgerEntry[],
): ResearchRequestLedgerEntry[] {
  return entries.slice(0, RESEARCH_MAX_REQUESTS_PER_RUN).map((entry) => {
    const serialized: ResearchRequestLedgerEntry = {
      requestKey: entry.requestKey,
      seedOffering: entry.seedOffering,
      languageCode: entry.languageCode,
      locationCode: entry.locationCode,
      providerTaskId: entry.providerTaskId,
      status: entry.status,
      requestedAt: entry.requestedAt,
      attemptedAt: entry.attemptedAt,
      retrievedAt: entry.retrievedAt,
      ideaCount: entry.ideaCount,
      providerResultCount: entry.providerResultCount,
      filterReasonCounts: entry.filterReasonCounts,
      providerCost: entry.providerCost,
      failureCode: entry.failureCode,
    };

    for (const key of Object.keys(serialized) as Array<keyof ResearchRequestLedgerEntry>) {
      if (!LEDGER_KEYS.includes(key)) {
        delete serialized[key];
      }
    }

    return serialized;
  });
}

export function ledgerHasSecrets(entries: ResearchRequestLedgerEntry[]): boolean {
  const serialized = JSON.stringify(entries).toLowerCase();
  return (
    serialized.includes("authorization") ||
    serialized.includes("basic ") ||
    serialized.includes("dataforseo_login") ||
    serialized.includes("dataforseo_password") ||
    serialized.includes("password")
  );
}

export function ledgerHasAmbiguousRequest(entries: ResearchRequestLedgerEntry[]): boolean {
  return entries.some((entry) => entry.status === "pending" || entry.status === "in_flight");
}

export function ledgerWasProviderAttempted(entries: ResearchRequestLedgerEntry[]): boolean {
  return entries.some((entry) => ledgerEntryWasAttempted(entry));
}

export function ledgerEntryWasAttempted(entry: ResearchRequestLedgerEntry): boolean {
  return entry.attemptedAt != null || ATTEMPTED_STATUSES.includes(entry.status);
}

export function ledgerEntrySafeToResume(entry: ResearchRequestLedgerEntry): boolean {
  if (ledgerEntryWasAttempted(entry)) {
    return false;
  }

  if (entry.status !== "pending" && entry.status !== "skipped") {
    return false;
  }

  if (!isResearchRequestKey(entry.requestKey)) {
    return false;
  }

  return requestKeyMatchesPair(entry.requestKey, entry.seedOffering, entry.languageCode);
}

export function safeUnattemptedEntries(
  entries: ResearchRequestLedgerEntry[],
): ResearchRequestLedgerEntry[] {
  return entries.filter((entry) => ledgerEntrySafeToResume(entry));
}

export function classifyLedgerReplay(entries: ResearchRequestLedgerEntry[]): {
  resumableKeys: string[];
  blockedKeys: string[];
} {
  const resumableKeys: string[] = [];
  const blockedKeys: string[] = [];
  for (const entry of entries) {
    if (ledgerEntrySafeToResume(entry)) {
      resumableKeys.push(entry.requestKey);
    } else {
      blockedKeys.push(entry.requestKey);
    }
  }

  return {
    resumableKeys: [...resumableKeys].sort(),
    blockedKeys: [...blockedKeys].sort(),
  };
}

export function buildRequestPlan(input: {
  offerings: string[];
  languages: string[];
  locationCode: number;
  requestedAt: string;
}): ResearchRequestLedgerEntry[] {
  const entries: ResearchRequestLedgerEntry[] = [];
  const keys = new Set<string>();
  for (const offering of input.offerings) {
    for (const language of input.languages) {
      const requestKey = researchRequestKey(offering, language);
      if (keys.has(requestKey)) {
        throw new Error("Research request plan refused duplicate request identity.");
      }
      keys.add(requestKey);
      entries.push({
        requestKey,
        seedOffering: offering,
        languageCode: language,
        locationCode: input.locationCode,
        providerTaskId: null,
        status: "pending",
        requestedAt: input.requestedAt,
        attemptedAt: null,
        retrievedAt: null,
        ideaCount: 0,
        providerResultCount: null,
        filterReasonCounts: null,
        providerCost: null,
        failureCode: null,
      });
    }
  }

  if (entries.length === 0) {
    throw new Error("Research request plan requires at least one offering and language pair.");
  }

  if (entries.length > RESEARCH_MAX_REQUESTS_PER_RUN) {
    throw new Error("Research request plan exceeds the maximum number of provider requests.");
  }

  if (ledgerHasSecrets(entries)) {
    throw new Error("Research request ledger refused to persist secrets.");
  }

  return entries;
}

export function findLedgerEntryByRequestKey(
  entries: ResearchRequestLedgerEntry[],
  requestKey: string,
): ResearchRequestLedgerEntry | null {
  return entries.find((entry) => entry.requestKey === requestKey) ?? null;
}

export function requestKeyWasAttempted(
  entries: ResearchRequestLedgerEntry[],
  requestKey: string,
): boolean {
  return entries.some(
    (entry) => entry.requestKey === requestKey && ledgerEntryWasAttempted(entry),
  );
}

export function uniquePlannedRequestKeys(entries: ResearchRequestLedgerEntry[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.requestKey)) {
      continue;
    }
    seen.add(entry.requestKey);
    keys.push(entry.requestKey);
  }
  return keys;
}
