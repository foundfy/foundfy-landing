import { RESEARCH_MAX_REQUESTS_PER_RUN } from "./config";
import {
  RESEARCH_REQUEST_STATUSES,
  type ResearchRequestLedgerEntry,
  type ResearchRequestStatus,
} from "./types";

const LEDGER_KEYS = [
  "seedOffering",
  "languageCode",
  "locationCode",
  "providerTaskId",
  "status",
  "requestedAt",
  "retrievedAt",
  "ideaCount",
  "providerCost",
  "failureCode",
] as const;

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
    const providerCost =
      typeof record.providerCost === "number" &&
      Number.isFinite(record.providerCost) &&
      record.providerCost >= 0
        ? record.providerCost
        : null;

    entries.push({
      seedOffering,
      languageCode,
      locationCode,
      providerTaskId: asNullableString(record.providerTaskId, 80),
      status: status as ResearchRequestStatus,
      requestedAt,
      retrievedAt: asNullableString(record.retrievedAt, 40),
      ideaCount,
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
      seedOffering: entry.seedOffering,
      languageCode: entry.languageCode,
      locationCode: entry.locationCode,
      providerTaskId: entry.providerTaskId,
      status: entry.status,
      requestedAt: entry.requestedAt,
      retrievedAt: entry.retrievedAt,
      ideaCount: entry.ideaCount,
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
  return entries.some((entry) =>
    entry.status === "in_flight" ||
    entry.status === "succeeded" ||
    entry.status === "zero_results" ||
    entry.status === "failed" ||
    entry.status === "timeout" ||
    entry.status === "rate_limited"
  );
}
