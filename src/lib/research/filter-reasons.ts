export const FILTER_REASON_COUNT_KEYS = [
  "emptyCount",
  "invalidCount",
  "brandOnlyCount",
  "seedDuplicateCount",
  "compactDuplicateCount",
  "cappedCount",
] as const;

export type FilterReasonCountKey = (typeof FILTER_REASON_COUNT_KEYS)[number];

export type ResearchFilterReasonCounts = {
  emptyCount: number;
  invalidCount: number;
  brandOnlyCount: number;
  seedDuplicateCount: number;
  compactDuplicateCount: number;
  cappedCount: number;
};

const KEY_SET = new Set<string>(FILTER_REASON_COUNT_KEYS);

export function emptyFilterReasonCounts(): ResearchFilterReasonCounts {
  return {
    emptyCount: 0,
    invalidCount: 0,
    brandOnlyCount: 0,
    seedDuplicateCount: 0,
    compactDuplicateCount: 0,
    cappedCount: 0,
  };
}

export function filterReasonCountSum(counts: ResearchFilterReasonCounts): number {
  return FILTER_REASON_COUNT_KEYS.reduce((sum, key) => sum + counts[key], 0);
}

export function isCanonicalFilterReasonCounts(
  value: unknown,
): value is ResearchFilterReasonCounts {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== FILTER_REASON_COUNT_KEYS.length) {
    return false;
  }

  for (const key of keys) {
    if (!KEY_SET.has(key)) {
      return false;
    }
    const count = record[key];
    if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
      return false;
    }
  }

  for (const key of FILTER_REASON_COUNT_KEYS) {
    if (!(key in record)) {
      return false;
    }
  }

  return true;
}

export function parseFilterReasonCounts(value: unknown): ResearchFilterReasonCounts | null {
  if (value == null) {
    return null;
  }

  if (!isCanonicalFilterReasonCounts(value)) {
    return null;
  }

  return {
    emptyCount: value.emptyCount,
    invalidCount: value.invalidCount,
    brandOnlyCount: value.brandOnlyCount,
    seedDuplicateCount: value.seedDuplicateCount,
    compactDuplicateCount: value.compactDuplicateCount,
    cappedCount: value.cappedCount,
  };
}

export function filterReasonCountsReconcile(input: {
  providerResultCount: number;
  ideaCount: number;
  filterReasonCounts: ResearchFilterReasonCounts;
}): boolean {
  return (
    input.providerResultCount === input.ideaCount + filterReasonCountSum(input.filterReasonCounts)
  );
}

export function mergeFilterReasonCounts(
  entries: Array<ResearchFilterReasonCounts | null | undefined>,
): ResearchFilterReasonCounts | null {
  const known: ResearchFilterReasonCounts[] = [];
  for (const entry of entries) {
    if (entry == null) {
      return null;
    }
    known.push(entry);
  }

  const merged = emptyFilterReasonCounts();
  for (const counts of known) {
    for (const key of FILTER_REASON_COUNT_KEYS) {
      merged[key] += counts[key];
    }
  }
  return merged;
}
