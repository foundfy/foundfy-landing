import { describe, expect, it } from "vitest";
import { buildSiteModelEvidence, deriveSiteModelUnderstanding } from "../derive";
import type { SiteModelPageInput } from "../types";
import { buildHeuristicSiteInterpretation } from "./heuristic";
import { validateInterpretationAgainstEvidence } from "./validate";

const FOUNDFY_HOMEPAGE_EXCERPT =
  "foundfy.Get early access →Be foundwhereverpeople search.A simpler way to understand and improve your search visibility.AnalyzeGoogle|AI search|Your audience|New opportunitiesScroll";

function foundfyPages(): SiteModelPageInput[] {
  return [
    {
      id: "page-home",
      requestedUrl: "https://foundfy.me/",
      finalUrl: "https://www.foundfy.me/",
      statusCode: 200,
      title: "Foundfy | Be found wherever people search.",
      h1: ["Be foundwhereverpeople search."],
      h2: [],
      h3: ["SEO insights", "Content opportunities"],
      htmlLang: "en",
      urlLocale: null,
      navLabels: [],
      mainExcerpt: FOUNDFY_HOMEPAGE_EXCERPT,
      contentHash: "abc",
      jsonLdTypes: [],
      jsonLdProperties: [],
      wordCount: 474,
      fetchedAt: "2026-09-14T16:26:12.000Z",
    },
    {
      id: "page-privacy",
      requestedUrl: "https://www.foundfy.me/privacy",
      finalUrl: "https://www.foundfy.me/privacy",
      statusCode: 200,
      title: "Privacy | Foundfy",
      h1: ["Privacy"],
      h2: [],
      h3: [],
      htmlLang: "en",
      urlLocale: null,
      navLabels: [],
      mainExcerpt: "Foundfy is in private beta. This page describes what happens when you use the current product.",
      contentHash: "def",
      jsonLdTypes: [],
      jsonLdProperties: [],
      wordCount: 386,
      fetchedAt: "2026-09-14T16:26:16.000Z",
    },
  ];
}

function foundfyModelInput() {
  const pages = foundfyPages();
  const understanding = deriveSiteModelUnderstanding({
    crawl: {
      id: "a731b780-dddd-4edb-8872-b902e401a5d2",
      websiteId: "website-foundfy",
      hostname: "foundfy.me",
      seedUrl: "https://foundfy.me/",
      pagesCrawled: 2,
      pagesDiscovered: 3,
      maxPages: 10,
    },
    pages,
    artifacts: [
      {
        id: "art-robots",
        artifactType: "robots_txt",
        url: "https://foundfy.me/robots.txt",
        statusCode: 200,
      },
    ],
  });
  const evidence = buildSiteModelEvidence({
    websiteId: "website-foundfy",
    crawlRunId: "a731b780-dddd-4edb-8872-b902e401a5d2",
    pages,
    artifacts: [],
  });

  return { understanding, evidence };
}

describe("buildHeuristicSiteInterpretation", () => {
  it("stays uncertain for the two-page foundfy.me sample", () => {
    const { understanding, evidence } = foundfyModelInput();
    const draft = buildHeuristicSiteInterpretation({ understanding, evidence });

    expect(draft.generator).toBe("heuristic");
    expect(draft.siteDescription).toContain("Foundfy | Be found wherever people search.");
    expect(draft.siteDescription).toContain("A simpler way to understand and improve your search visibility.");
    expect(draft.offers).toEqual([]);
    expect(draft.audiences).toEqual([]);
    expect(draft.locations).toEqual([]);
    expect(draft.uncertainty.some((note) => /2 pages/i.test(note))).toBe(true);
    expect(draft.uncertainty.some((note) => /JSON-LD/i.test(note))).toBe(true);
    expect(draft.uncertainty.some((note) => /navigation/i.test(note))).toBe(true);
    expect(draft.siteDescription).not.toMatch(/website owners|marketers|creators/i);
    expect(draft.siteDescription).not.toMatch(/Google Search Console|ranking|keyword/i);
  });
});

describe("validateInterpretationAgainstEvidence", () => {
  it("rejects invented audiences on a two-page sample", () => {
    const { understanding } = foundfyModelInput();
    const result = validateInterpretationAgainstEvidence({
      understanding,
      fields: {
        siteDescription:
          "The homepage title is Foundfy | Be found wherever people search.",
        offers: [],
        audiences: ["website owners", "marketers"],
        locations: [],
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Audience/i);
    }
  });

  it("rejects GSC and ranking language", () => {
    const { understanding } = foundfyModelInput();
    const result = validateInterpretationAgainstEvidence({
      understanding,
      fields: {
        siteDescription: "Foundfy ranks well in Google Search Console for marketers.",
        offers: [],
        audiences: [],
        locations: [],
      },
    });

    expect(result.ok).toBe(false);
  });

  it("accepts a grounded description from homepage evidence", () => {
    const { understanding } = foundfyModelInput();
    const result = validateInterpretationAgainstEvidence({
      understanding,
      fields: {
        siteDescription:
          "The homepage presents Foundfy as a way to be found wherever people search and improve search visibility.",
        offers: [],
        audiences: [],
        locations: [],
      },
    });

    expect(result.ok).toBe(true);
  });
});
