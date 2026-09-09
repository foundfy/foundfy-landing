import { describe, expect, it } from "vitest";
import { generateObservationDrafts } from "../engine";
import { getRuleDefinition } from "../rules";
import {
  COVERAGE_FIXTURE,
  EXPECTED_COVERAGE_RULES,
  USER_REQUESTED_RULE_KEYS,
} from "./coverage-fixture";

describe("coverage fixture", () => {
  it("triggers the requested observation rules with deterministic severity and evidence", () => {
    const observations = generateObservationDrafts(COVERAGE_FIXTURE);

    for (const ruleKey of USER_REQUESTED_RULE_KEYS) {
      expect(
        observations.some((observation) => observation.ruleKey === ruleKey),
        `expected rule ${ruleKey} to trigger`,
      ).toBe(true);
    }

    for (const expected of EXPECTED_COVERAGE_RULES) {
      const matches = observations.filter(
        (observation) => observation.ruleKey === expected.ruleKey,
      );

      const match = matches.find((observation) => {
        if ("pageId" in expected && expected.pageId) {
          return observation.pageId === expected.pageId;
        }

        if ("pageUrl" in expected && expected.pageUrl) {
          return observation.pageUrl === expected.pageUrl;
        }

        return false;
      });

      expect(match, `expected ${expected.ruleKey} for fixture subject`).toBeDefined();
      expect(match?.severity).toBe(expected.severity);
      expect(match?.evidence).toBeTruthy();
      expect(getRuleDefinition(expected.ruleKey).severity).toBe(expected.severity);
    }
  });

  it("includes explicit evidence for key requested findings", () => {
    const observations = generateObservationDrafts(COVERAGE_FIXTURE);

    const missingTitle = observations.find(
      (observation) =>
        observation.ruleKey === "page_fundamentals.missing_title" &&
        observation.pageId === "page-incomplete",
    );
    expect(missingTitle?.evidence).toMatchObject({
      finalUrl: "https://example.test/incomplete",
      title: null,
    });

    const brokenLink = observations.find(
      (observation) => observation.ruleKey === "internal_structure.broken_internal_link",
    );
    expect(brokenLink?.evidence).toMatchObject({
      linkToUrl: "https://example.test/missing",
      targetStatusCode: 404,
    });

    const duplicateTitles = observations.filter(
      (observation) => observation.ruleKey === "page_fundamentals.duplicate_title",
    );
    expect(duplicateTitles).toHaveLength(2);
    expect(duplicateTitles[0]?.evidence.pageCount).toBe(2);
  });
});
