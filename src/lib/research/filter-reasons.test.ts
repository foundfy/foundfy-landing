import { describe, expect, it } from "vitest";
import {
  emptyFilterReasonCounts,
  filterReasonCountsReconcile,
  isCanonicalFilterReasonCounts,
  parseFilterReasonCounts,
} from "./filter-reasons";

const valid = {
  emptyCount: 0,
  invalidCount: 0,
  brandOnlyCount: 0,
  seedDuplicateCount: 2,
  compactDuplicateCount: 0,
  cappedCount: 0,
};

describe("canonical filterReasonCounts", () => {
  it("accepts a complete six-key nonnegative integer object", () => {
    expect(isCanonicalFilterReasonCounts(valid)).toBe(true);
    expect(parseFilterReasonCounts(valid)).toEqual(valid);
  });

  it("treats missing, null, and omitted provenance as unknown", () => {
    expect(parseFilterReasonCounts(null)).toBeNull();
    expect(parseFilterReasonCounts(undefined)).toBeNull();
    expect(parseFilterReasonCounts(emptyFilterReasonCounts())).toEqual(emptyFilterReasonCounts());
  });

  it("rejects missing keys, extra keys, negatives, strings, floats, null values, and nested objects", () => {
    const { emptyCount: _omitted, ...missing } = valid;
    expect(isCanonicalFilterReasonCounts(missing)).toBe(false);
    expect(isCanonicalFilterReasonCounts({ ...valid, extraCount: 1 })).toBe(false);
    expect(isCanonicalFilterReasonCounts({ ...valid, seedDuplicateCount: -1 })).toBe(false);
    expect(isCanonicalFilterReasonCounts({ ...valid, seedDuplicateCount: "1" })).toBe(false);
    expect(isCanonicalFilterReasonCounts({ ...valid, seedDuplicateCount: 1.5 })).toBe(false);
    expect(isCanonicalFilterReasonCounts({ ...valid, seedDuplicateCount: null })).toBe(false);
    expect(isCanonicalFilterReasonCounts({ ...valid, seedDuplicateCount: { nested: 1 } })).toBe(
      false,
    );
    expect(parseFilterReasonCounts(missing)).toBeNull();
  });

  it("rejects accounting that does not reconcile", () => {
    expect(
      filterReasonCountsReconcile({
        providerResultCount: 7,
        ideaCount: 1,
        filterReasonCounts: valid,
      }),
    ).toBe(false);
    expect(
      filterReasonCountsReconcile({
        providerResultCount: 3,
        ideaCount: 1,
        filterReasonCounts: valid,
      }),
    ).toBe(true);
  });
});
