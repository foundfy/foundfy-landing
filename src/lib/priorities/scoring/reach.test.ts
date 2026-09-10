import { describe, expect, it } from "vitest";
import {
  buildBrokenLinkTargetCounts,
  calculateReachScore,
} from "./reach";
import type { PriorityContext } from "../types";
import { buildStoredObservation } from "../fixtures/test-helpers";

function buildContext(
  overrides: Partial<PriorityContext> = {},
): PriorityContext {
  return {
    crawlRunId: "run-1",
    websiteId: "site-1",
    totalPagesCrawled: 100,
    brokenLinkTargetCounts: new Map(),
    ...overrides,
  };
}

describe("calculateReachScore", () => {
  it("scores one affected page out of 100 as low reach", () => {
    const observation = buildStoredObservation({
      ruleKey: "page_fundamentals.missing_title",
      subjectKey: "page:/pricing",
      pageUrl: "https://foundfy.me/pricing",
    });

    const result = calculateReachScore(observation, buildContext());

    expect(result.affectedPages).toBe(1);
    expect(result.score).toBe(1);
    expect(result.reason).toContain("1 of 100");
  });

  it("scores duplicate groups from evidence pageCount", () => {
    const observation = buildStoredObservation({
      ruleKey: "page_fundamentals.duplicate_title",
      subjectKey: "title:Same title",
      evidence: { pageCount: 70 },
    });

    const result = calculateReachScore(observation, buildContext());

    expect(result.affectedPages).toBe(70);
    expect(result.score).toBe(70);
  });

  it("scores site-wide discovery issues at full reach", () => {
    const observation = buildStoredObservation({
      ruleKey: "site_discovery.robots_txt_missing",
      subjectKey: "site:robots.txt",
    });

    const result = calculateReachScore(observation, buildContext());

    expect(result.score).toBe(100);
    expect(result.affectedPages).toBe(100);
  });

  it("uses broken link frequency from crawl evidence", () => {
    const observation = buildStoredObservation({
      ruleKey: "internal_structure.broken_internal_link",
      subjectKey: "link:/dead",
      evidence: { linkToUrl: "https://foundfy.me/dead" },
    });

    const context = buildContext({
      brokenLinkTargetCounts: new Map([
        ["https://foundfy.me/dead", 12],
      ]),
    });

    const result = calculateReachScore(observation, context);

    expect(result.affectedPages).toBe(12);
    expect(result.score).toBe(12);
  });

  it("never invents page counts when duplicate evidence is missing", () => {
    const observation = buildStoredObservation({
      ruleKey: "page_fundamentals.duplicate_meta_description",
      subjectKey: "description:Shared",
      evidence: {},
    });

    const result = calculateReachScore(observation, buildContext({ totalPagesCrawled: 50 }));

    expect(result.affectedPages).toBe(1);
    expect(result.score).toBe(2);
  });
});

describe("buildBrokenLinkTargetCounts", () => {
  it("counts repeated broken link targets across observations", () => {
    const observations = [
      buildStoredObservation({
        ruleKey: "internal_structure.broken_internal_link",
        subjectKey: "link-1",
        evidence: { linkToUrl: "https://foundfy.me/dead" },
      }),
      buildStoredObservation({
        ruleKey: "internal_structure.broken_internal_link",
        subjectKey: "link-2",
        evidence: { linkToUrl: "https://foundfy.me/dead" },
      }),
      buildStoredObservation({
        ruleKey: "page_fundamentals.missing_title",
        subjectKey: "page:/",
        evidence: {},
      }),
    ];

    const counts = buildBrokenLinkTargetCounts(observations);

    expect(counts.get("https://foundfy.me/dead")).toBe(2);
    expect(counts.size).toBe(1);
  });
});
