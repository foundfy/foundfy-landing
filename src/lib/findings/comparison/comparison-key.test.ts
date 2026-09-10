import { describe, expect, it } from "vitest";
import { buildStoredObservation } from "@/lib/priorities/fixtures/test-helpers";
import { buildComparisonKey } from "./comparison-key";

describe("buildComparisonKey", () => {
  it("matches the same page issue across different run-scoped subject keys", () => {
    const previous = buildStoredObservation({
      id: "prev-1",
      ruleKey: "page_fundamentals.missing_title",
      subjectKey: "page:uuid-old:missing_title",
      pageUrl: "https://www.example.com/about",
      evidence: {
        finalUrl: "https://www.example.com/about",
        requestedUrl: "https://www.example.com/about",
      },
    });
    const current = buildStoredObservation({
      id: "curr-1",
      ruleKey: "page_fundamentals.missing_title",
      subjectKey: "page:uuid-new:missing_title",
      pageUrl: "https://example.com/about",
      evidence: {
        finalUrl: "https://example.com/about",
        requestedUrl: "https://example.com/about",
      },
    });

    expect(buildComparisonKey(previous)).toBe(buildComparisonKey(current));
  });

  it("uses requested URL for redirecting_url", () => {
    const observation = buildStoredObservation({
      ruleKey: "indexability.redirecting_url",
      subjectKey: "page:uuid:redirect",
      pageUrl: "https://example.com/old",
      evidence: {
        requestedUrl: "https://example.com/old",
        finalUrl: "https://example.com/new",
      },
    });

    expect(buildComparisonKey(observation)).toBe(
      "indexability.redirecting_url|requested|https://example.com/old",
    );
  });

  it("uses source and target for broken internal links", () => {
    const observation = buildStoredObservation({
      ruleKey: "internal_structure.broken_internal_link",
      subjectKey: "link:uuid-old",
      pageUrl: "https://example.com/source",
      evidence: {
        linkToUrl: "https://www.example.com/dead",
      },
    });

    expect(buildComparisonKey(observation)).toBe(
      "internal_structure.broken_internal_link|link|https://example.com/source→https://example.com/dead",
    );
  });

  it("compares duplicate title findings per page URL", () => {
    const pageA = buildStoredObservation({
      ruleKey: "page_fundamentals.duplicate_title",
      subjectKey: "page:a:duplicate_title",
      pageUrl: "https://example.com/a",
      evidence: {
        title: "Same",
        duplicatePages: ["https://example.com/a", "https://example.com/b"],
      },
    });
    const pageB = buildStoredObservation({
      ruleKey: "page_fundamentals.duplicate_title",
      subjectKey: "page:b:duplicate_title",
      pageUrl: "https://example.com/b",
      evidence: {
        title: "Same",
        duplicatePages: ["https://example.com/a", "https://example.com/b"],
      },
    });

    expect(buildComparisonKey(pageA)).not.toBe(buildComparisonKey(pageB));
  });

  it("does not depend on title or recommendation-adjacent fields", () => {
    const base = buildStoredObservation({
      ruleKey: "indexability.canonical_missing",
      subjectKey: "page:uuid:canonical_missing",
      pageUrl: "https://example.com/pricing",
      evidence: { finalUrl: "https://example.com/pricing" },
    });
    const copyChanged = {
      ...base,
      title: "Different title copy",
      description: "Different description copy",
    };

    expect(buildComparisonKey(base)).toBe(buildComparisonKey(copyChanged));
  });
});
