import { describe, expect, it } from "vitest";
import { buildPriorityContext, generatePriorityDrafts } from "./engine";
import {
  buildStoredObservation,
  resetObservationCounter,
} from "./fixtures/test-helpers";

describe("generatePriorityDrafts", () => {
  it("is deterministic and idempotent for the same crawl evidence", () => {
    resetObservationCounter();

    const observations = [
      buildStoredObservation({
        id: "obs-redirect",
        ruleKey: "indexability.redirecting_url",
        subjectKey: "page:/",
        pageUrl: "https://foundfy.me/",
      }),
      buildStoredObservation({
        id: "obs-title",
        ruleKey: "page_fundamentals.missing_title",
        subjectKey: "page:/blog",
        pageUrl: "https://foundfy.me/blog",
      }),
    ];

    const context = buildPriorityContext({
      crawlRunId: "run-1",
      websiteId: "site-1",
      totalPagesCrawled: 5,
      observations,
    });

    const first = generatePriorityDrafts({ observations, context });
    const second = generatePriorityDrafts({ observations, context });

    expect(first).toEqual(second);
  });

  it("ranks site-wide issues above isolated low-impact issues", () => {
    resetObservationCounter();

    const observations = [
      buildStoredObservation({
        id: "obs-redirect",
        ruleKey: "indexability.redirecting_url",
        subjectKey: "page:/",
        pageUrl: "https://foundfy.me/",
      }),
      buildStoredObservation({
        id: "obs-robots",
        ruleKey: "site_discovery.robots_txt_missing",
        subjectKey: "site:robots.txt",
      }),
    ];

    const context = buildPriorityContext({
      crawlRunId: "run-1",
      websiteId: "site-1",
      totalPagesCrawled: 100,
      observations,
    });

    const priorities = generatePriorityDrafts({ observations, context });
    const top = priorities[0];

    expect(top?.ruleKey).toBe("site_discovery.robots_txt_missing");
    expect(top?.priorityLevel).toBe("critical");
    expect(priorities.at(-1)?.ruleKey).toBe("indexability.redirecting_url");
  });

  it("does not promote a one-page redirect to HIGH when reach is 100%", () => {
    resetObservationCounter();

    const observations = [
      buildStoredObservation({
        id: "obs-redirect",
        ruleKey: "indexability.redirecting_url",
        subjectKey: "page:/",
        pageUrl: "https://foundfy.me/",
        severity: "info",
      }),
    ];

    const context = buildPriorityContext({
      crawlRunId: "run-1",
      websiteId: "site-1",
      totalPagesCrawled: 1,
      observations,
    });

    const [priority] = generatePriorityDrafts({ observations, context });

    expect(priority?.rawPriorityScore).toBe(63);
    expect(priority?.priorityScore).toBe(34);
    expect(priority?.priorityLevel).toBe("low");
    expect(priority?.priorityCeiling).toBe("low");
  });

  it("ranks missing title above redirect info on a multi-page crawl", () => {
    resetObservationCounter();

    const observations = [
      buildStoredObservation({
        id: "obs-redirect",
        ruleKey: "indexability.redirecting_url",
        subjectKey: "page:/",
        pageUrl: "https://foundfy.me/",
        severity: "info",
      }),
      buildStoredObservation({
        id: "obs-title",
        ruleKey: "page_fundamentals.missing_title",
        subjectKey: "page:/blog/post",
        pageUrl: "https://foundfy.me/blog/post",
        severity: "warning",
      }),
    ];

    const context = buildPriorityContext({
      crawlRunId: "run-1",
      websiteId: "site-1",
      totalPagesCrawled: 100,
      observations,
    });

    const priorities = generatePriorityDrafts({ observations, context });
    const titlePriority = priorities.find(
      (item) => item.ruleKey === "page_fundamentals.missing_title",
    );
    const redirectPriority = priorities.find(
      (item) => item.ruleKey === "indexability.redirecting_url",
    );

    expect(titlePriority?.priorityScore).toBeGreaterThan(
      redirectPriority?.priorityScore ?? 0,
    );
    expect(titlePriority?.priorityLevel).toBe("medium");
    expect(redirectPriority?.rawPriorityScore).toBe(33);
    expect(redirectPriority?.priorityScore).toBe(33);
    expect(redirectPriority?.priorityLevel).toBe("low");
  });

  it("ranks noindex above cosmetic metadata issues", () => {
    resetObservationCounter();

    const observations = [
      buildStoredObservation({
        id: "obs-noindex",
        ruleKey: "indexability.noindex",
        subjectKey: "page:/pricing",
        pageUrl: "https://foundfy.me/pricing",
      }),
      buildStoredObservation({
        id: "obs-title-length",
        ruleKey: "page_fundamentals.title_length_out_of_range",
        subjectKey: "page:/about",
        pageUrl: "https://foundfy.me/about",
      }),
      buildStoredObservation({
        id: "obs-multiple-h1",
        ruleKey: "page_fundamentals.multiple_h1",
        subjectKey: "page:/team",
        pageUrl: "https://foundfy.me/team",
      }),
    ];

    const context = buildPriorityContext({
      crawlRunId: "run-1",
      websiteId: "site-1",
      totalPagesCrawled: 1,
      observations,
    });

    const priorities = generatePriorityDrafts({ observations, context });

    expect(priorities[0]?.ruleKey).toBe("indexability.noindex");
    expect(priorities[0]?.priorityLevel).toBe("critical");
    expect(
      priorities.find((item) => item.ruleKey === "page_fundamentals.title_length_out_of_range")
        ?.rank,
    ).toBeGreaterThan(1);
  });

  it("assigns stable ranks in priority order", () => {
    resetObservationCounter();

    const observations = [
      buildStoredObservation({
        id: "obs-b",
        ruleKey: "indexability.canonical_missing",
        subjectKey: "page:/b",
      }),
      buildStoredObservation({
        id: "obs-a",
        ruleKey: "indexability.canonical_missing",
        subjectKey: "page:/a",
      }),
    ];

    const context = buildPriorityContext({
      crawlRunId: "run-1",
      websiteId: "site-1",
      totalPagesCrawled: 10,
      observations,
    });

    const priorities = generatePriorityDrafts({ observations, context });

    expect(priorities.map((item) => item.rank)).toEqual([1, 2]);
    expect(priorities[0]?.subjectKey).toBe("page:/a");
    expect(priorities[1]?.subjectKey).toBe("page:/b");
  });
});

describe("priority fixtures", () => {
  it("scores a one-page site with full reach for page-level issues", () => {
    resetObservationCounter();

    const observations = [
      buildStoredObservation({
        ruleKey: "page_fundamentals.missing_title",
        subjectKey: "page:/",
        pageUrl: "https://example.com/",
      }),
    ];

    const context = buildPriorityContext({
      crawlRunId: "run-1",
      websiteId: "site-1",
      totalPagesCrawled: 1,
      observations,
    });

    const [priority] = generatePriorityDrafts({ observations, context });

    expect(priority?.reachScore).toBe(100);
    expect(priority?.priorityScore).toBeGreaterThanOrEqual(80);
  });

  it("scores repeated broken links higher on a multi-page site", () => {
    resetObservationCounter();

    const observations = [
      buildStoredObservation({
        id: "broken-1",
        ruleKey: "internal_structure.broken_internal_link",
        subjectKey: "link-1",
        evidence: { linkToUrl: "https://example.com/dead", targetStatusCode: 404 },
      }),
      buildStoredObservation({
        id: "broken-2",
        ruleKey: "internal_structure.broken_internal_link",
        subjectKey: "link-2",
        evidence: { linkToUrl: "https://example.com/dead", targetStatusCode: 404 },
      }),
      buildStoredObservation({
        id: "broken-3",
        ruleKey: "internal_structure.broken_internal_link",
        subjectKey: "link-3",
        evidence: { linkToUrl: "https://example.com/dead", targetStatusCode: 404 },
      }),
    ];

    const context = buildPriorityContext({
      crawlRunId: "run-1",
      websiteId: "site-1",
      totalPagesCrawled: 10,
      observations,
    });

    const priorities = generatePriorityDrafts({ observations, context });

    expect(priorities.every((item) => item.reachScore === 30)).toBe(true);
    expect(priorities[0]?.explainability.affectedPages).toBe(3);
  });

  it("scores site-wide discovery issues with maximum reach", () => {
    resetObservationCounter();

    const observations = [
      buildStoredObservation({
        ruleKey: "site_discovery.sitemap_missing",
        subjectKey: "site:sitemap.xml",
      }),
    ];

    const context = buildPriorityContext({
      crawlRunId: "run-1",
      websiteId: "site-1",
      totalPagesCrawled: 25,
      observations,
    });

    const [priority] = generatePriorityDrafts({ observations, context });

    expect(priority?.reachScore).toBe(100);
    expect(priority?.priorityLevel).toBe("critical");
    expect(priority?.priorityCeiling).toBeNull();
    expect(priority?.explainability.reachReason).toContain("Site-wide");
  });
});
