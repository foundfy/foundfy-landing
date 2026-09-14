import { describe, expect, it } from "vitest";
import { buildSiteModelEvidence, deriveSiteModelUnderstanding } from "./derive";
import { buildSiteUnderstandingView } from "./display";
import type { SiteModelPageInput, SiteModelRecord } from "./types";
import { SITE_MODEL_DERIVATION_VERSION, SITE_MODEL_ROW_VERSION } from "./types";

const FOUNDFY_HOMEPAGE_EXCERPT =
  "foundfy.Get early access →Be foundwhereverpeople search.A simpler way to understand and improve your search visibility.AnalyzeGoogle|AI search|Your audience|New opportunitiesScroll";

const FOUNDFY_PRIVACY_EXCERPT =
  "← FoundfyPrivacyFoundfy is in private beta. This page describes what happens when you use the current product.Website analysisWhen you submit a URL, Foundfy processes that address ";

function foundfyPages(): SiteModelPageInput[] {
  return [
    {
      id: "page-home",
      requestedUrl: "https://foundfy.me/",
      finalUrl: "https://www.foundfy.me/",
      statusCode: 200,
      title: "Foundfy | Be found wherever people search.",
      h1: ["Be foundwhereverpeople search."],
      h2: [
        "Know what matters.Know what to do next.",
        "Search is changing.So are we.",
        "Tell us a bit about yourself.",
        "Found today.Furthertomorrow.",
      ],
      h3: [
        "Find",
        "Understand",
        "Improve",
        "Stay ahead",
        "SEO insights",
        "Content opportunities",
        "Technical checks",
        "AI search, ahead",
        "What best describes you?",
      ],
      htmlLang: "en",
      urlLocale: null,
      navLabels: [],
      mainExcerpt: FOUNDFY_HOMEPAGE_EXCERPT.padEnd(1000, "x").slice(0, 1000),
      contentHash: "3c870ad5e246de8ad525cf390a9890d65b8cb0134febec6c2a365d0bbf5eb445",
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
      h2: [
        "Website analysis",
        "What we store",
        "Explain further",
        "Questions and deletion",
      ],
      h3: [],
      htmlLang: "en",
      urlLocale: null,
      navLabels: [],
      mainExcerpt: FOUNDFY_PRIVACY_EXCERPT,
      contentHash: "b9ce8a680618ebb97729f256b4e6c24718e2057c354ce587cbce4deb861266bc",
      jsonLdTypes: [],
      jsonLdProperties: [],
      wordCount: 386,
      fetchedAt: "2026-09-14T16:26:16.000Z",
    },
  ];
}

describe("deriveSiteModelUnderstanding", () => {
  it("builds a deterministic foundfy.me understanding without inventing offerings", () => {
    const understanding = deriveSiteModelUnderstanding({
      crawl: {
        id: "a731b780-dddd-4edb-8872-b902e401a5d2",
        websiteId: "a1dc5561-8cca-4e46-a336-691ce29e3075",
        hostname: "foundfy.me",
        seedUrl: "https://foundfy.me/",
        pagesCrawled: 2,
        pagesDiscovered: 3,
        maxPages: 10,
      },
      pages: foundfyPages(),
      artifacts: [
        {
          id: "art-robots",
          artifactType: "robots_txt",
          url: "https://foundfy.me/robots.txt",
          statusCode: 200,
        },
        {
          id: "art-sitemap-www",
          artifactType: "sitemap_xml",
          url: "https://www.foundfy.me/sitemap.xml",
          statusCode: 200,
        },
      ],
    });

    expect(understanding.derivationVersion).toBe(SITE_MODEL_DERIVATION_VERSION);
    expect(understanding.hostname).toBe("foundfy.me");
    expect(understanding.pages).toHaveLength(2);
    expect(understanding.pages[0]?.pathClass).toBe("homepage");
    expect(understanding.pages[1]?.pathClass).toBe("utility");
    expect(understanding.pageTypeCounts).toEqual([
      { pathClass: "homepage", count: 1 },
      { pathClass: "utility", count: 1 },
    ]);
    expect(understanding.languages).toEqual({
      htmlLangs: ["en"],
      urlLocales: [],
    });
    expect(understanding.navigationLabels).toEqual([]);
    expect(understanding.jsonLdTypes).toEqual([]);
    expect(understanding.jsonLdPropertyCount).toBe(0);
    expect(understanding.sample.sampleIsCapped).toBe(true);
    expect(understanding.sample.fetchedEveryDiscoveredHtmlPage).toBe(false);
    expect(understanding.pages[0]?.excerpt?.length).toBe(1000);
  });

  it("classifies locale homes and does not treat nav labels as confirmed offerings", () => {
    const understanding = deriveSiteModelUnderstanding({
      crawl: {
        id: "run-dbhobby",
        websiteId: "website-dbhobby",
        hostname: "dbhobby.com",
        seedUrl: "https://www.dbhobby.com/",
        pagesCrawled: 3,
        pagesDiscovered: 128,
        maxPages: 10,
      },
      pages: [
        {
          id: "p1",
          requestedUrl: "https://www.dbhobby.com/",
          finalUrl: "https://www.dbhobby.com/",
          statusCode: 200,
          title: "DBHOBBY",
          h1: ["DBHOBBY"],
          h2: ["Productes"],
          h3: [],
          htmlLang: "ca",
          urlLocale: null,
          navLabels: ["La seda", "Pintura", "Cart"],
          mainExcerpt: "Pintura sobre seda",
          contentHash: "abc",
          jsonLdTypes: [],
          jsonLdProperties: [],
          wordCount: 80,
          fetchedAt: "2026-09-14T12:00:00.000Z",
        },
        {
          id: "p2",
          requestedUrl: "https://www.dbhobby.com/es",
          finalUrl: "https://www.dbhobby.com/es",
          statusCode: 200,
          title: "DBHOBBY ES",
          h1: [],
          h2: ["Productos"],
          h3: [],
          htmlLang: "es",
          urlLocale: "es",
          navLabels: ["La seda", "Pintura"],
          mainExcerpt: "Pintura sobre seda",
          contentHash: "def",
          jsonLdTypes: [],
          jsonLdProperties: [
            {
              type: "Product",
              name: "Seda",
            },
          ],
          wordCount: 90,
          fetchedAt: "2026-09-14T12:00:01.000Z",
        },
        {
          id: "p3",
          requestedUrl: "https://www.dbhobby.com/ca/category/pintura-en-seda",
          finalUrl: "https://www.dbhobby.com/ca/category/pintura-en-seda",
          statusCode: 200,
          title: "Pintura en seda",
          h1: ["Pintura"],
          h2: [],
          h3: [],
          htmlLang: "ca",
          urlLocale: "ca",
          navLabels: ["La seda"],
          mainExcerpt: "Catalog",
          contentHash: "ghi",
          jsonLdTypes: ["Product"],
          jsonLdProperties: [],
          wordCount: 40,
          fetchedAt: "2026-09-14T12:00:02.000Z",
        },
      ],
      artifacts: [],
    });

    expect(understanding.pages.map((page) => page.pathClass)).toEqual([
      "homepage",
      "locale_home",
      "category_service",
    ]);
    expect(understanding.languages.urlLocales).toEqual(["es", "ca"]);
    expect(understanding.navigationLabels).toEqual(["La seda", "Pintura", "Cart"]);
    expect(understanding.jsonLdTypes).toEqual(["Product"]);
    expect(understanding.jsonLdPropertyCount).toBe(1);
    expect(understanding.sample.sampleIsCapped).toBe(true);
  });

  it("records provenance without promoting interpretation fields", () => {
    const pages = foundfyPages();
    const artifacts = [
      {
        id: "art-robots",
        artifactType: "robots_txt" as const,
        url: "https://foundfy.me/robots.txt",
        statusCode: 200,
      },
    ];
    const evidence = buildSiteModelEvidence({
      websiteId: "website-1",
      crawlRunId: "run-1",
      pages,
      artifacts,
    });

    expect(evidence.source).toBe("crawl");
    expect(evidence.pageIds).toEqual(["page-home", "page-privacy"]);
    expect(evidence.artifactIds).toEqual(["art-robots"]);
    expect(evidence.fields).toContain("mainExcerpt");
    expect(evidence.fields).toContain("jsonLdProperties");
  });
});

describe("buildSiteUnderstandingView", () => {
  it("labels foundfy.me as observed, small, and unconfirmed", () => {
    const understanding = deriveSiteModelUnderstanding({
      crawl: {
        id: "run-foundfy",
        websiteId: "website-foundfy",
        hostname: "foundfy.me",
        seedUrl: "https://foundfy.me/",
        pagesCrawled: 2,
        pagesDiscovered: 3,
        maxPages: 10,
      },
      pages: foundfyPages(),
      artifacts: [
        {
          id: "art-robots",
          artifactType: "robots_txt",
          url: "https://foundfy.me/robots.txt",
          statusCode: 200,
        },
      ],
    });

    const model: SiteModelRecord = {
      id: "model-1",
      websiteId: "website-foundfy",
      sourceCrawlRunId: "run-foundfy",
      version: SITE_MODEL_ROW_VERSION,
      status: "draft",
      understanding,
      interpretation: null,
      confirmed: null,
      evidence: buildSiteModelEvidence({
        websiteId: "website-foundfy",
        crawlRunId: "run-foundfy",
        pages: foundfyPages(),
        artifacts: [],
      }),
      derivedAt: "2026-09-14T16:26:20.000Z",
    };

    const view = buildSiteUnderstandingView(model);

    expect(view.heading).toBe("This is how Foundfy currently understands this site");
    expect(view.statusLabel).toContain("not confirmed");
    expect(view.coverageCopy).toContain("This sample is small");
    expect(view.pages[0]?.pathClassLabel).toBe("Homepage");
    expect(view.pages[1]?.pathClassLabel).toBe("Utility URL");
    expect(view.pages[1]?.pathLabel).toBe("/privacy");
    expect(view.navigationCopy).toContain("No navigation labels");
    expect(view.structuredDataCopy).toContain("not inferring products");
    expect(view.confirmationNote).toContain("not a list of tasks");
    expect(view.sampleCopy).not.toMatch(/Google listed/i);
  });
});
