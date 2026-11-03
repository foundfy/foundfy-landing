import { describe, expect, it } from "vitest";
import { buildSiteInterpretationView } from "./display";
import type { SiteModelRecord } from "../types";
import { SITE_MODEL_ROW_VERSION } from "../types";

function model(overrides: Partial<SiteModelRecord> = {}): SiteModelRecord {
  return {
    id: "model-1",
    websiteId: "website-foundfy",
    sourceCrawlRunId: "run-foundfy",
    version: SITE_MODEL_ROW_VERSION,
    status: "draft",
    understanding: {
      derivationVersion: 1,
      hostname: "foundfy.me",
      seedUrl: "https://foundfy.me/",
      sample: {
        pagesCrawled: 2,
        pagesDiscovered: 3,
        maxPages: 10,
        fetchedHttp200Count: 2,
        sampleIsCapped: true,
        fetchedEveryDiscoveredHtmlPage: false,
      },
      pageTypeCounts: [],
      pages: [],
      languages: { htmlLangs: ["en"], urlLocales: [] },
      navigationLabels: [],
      jsonLdTypes: [],
      jsonLdPropertyCount: 0,
      siteDiscovery: { robots: null, sitemaps: [] },
    },
    interpretation: {
      promptVersion: "site-interpretation-v1",
      generatedAt: "2026-09-15T12:00:00.000Z",
      generator: "heuristic",
      status: "ready",
      evidenceHash: "hash",
      sourceCrawlRunId: "run-foundfy",
      siteDescription:
        "The homepage title is “Foundfy | Be found wherever people search.”",
      offers: [],
      audiences: [],
      locations: [],
      uncertainty: ["Only 2 pages were fetched."],
    },
    confirmed: null,
    evidence: {
      source: "crawl",
      websiteId: "website-foundfy",
      crawlRunId: "run-foundfy",
      pageIds: [],
      artifactIds: [],
      fields: [],
    },
    derivedAt: "2026-09-15T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildSiteInterpretationView", () => {
  it("shows a draft interpretation the user can confirm", () => {
    const view = buildSiteInterpretationView(model());

    expect(view.heading).toBe("Here’s what we understand about your site.");
    expect(view.statusLabel).toBe("Draft · not confirmed");
    expect(view.askCopy).toBe("Is this right?");
    expect(view.canConfirm).toBe(true);
    expect(view.narrative).toContain("Foundfy | Be found wherever people search.");
    expect(view.narrative).toContain("Who should find it is not clear");
    expect(view.uncertaintyPreview).toEqual(["Only 2 pages were fetched."]);
    expect(view.whySummary).toBe("Why does Foundfy think this?");
  });

  it("shows confirmed copy without asking again", () => {
    const view = buildSiteInterpretationView(
      model({
        status: "confirmed",
        confirmed: {
          confirmedAt: "2026-09-15T12:05:00.000Z",
          sourceInterpretationGeneratedAt: "2026-09-15T12:00:00.000Z",
          sourceGenerator: "heuristic",
          evidenceHash: "hash",
          sourceCrawlRunId: "run-foundfy",
          siteDescription: "Foundfy helps people get found in search.",
          offers: ["search visibility"],
          audiences: ["website owners"],
          locations: [],
        },
      }),
    );

    expect(view.statusLabel).toBe("Confirmed");
    expect(view.askCopy).toBeNull();
    expect(view.canConfirm).toBe(false);
    expect(view.canEdit).toBe(true);
    expect(view.narrative).toContain("Foundfy helps people get found in search.");
    expect(view.narrative).toContain("Who should find it: website owners.");
  });

  it("keeps confirmed copy when a later crawl makes the model stale", () => {
    const view = buildSiteInterpretationView(
      model({
        status: "stale",
        confirmed: {
          confirmedAt: "2026-09-15T12:05:00.000Z",
          sourceInterpretationGeneratedAt: "2026-09-15T12:00:00.000Z",
          sourceGenerator: "heuristic",
          evidenceHash: "hash",
          sourceCrawlRunId: "run-old",
          siteDescription: "Foundfy helps people get found in search.",
          offers: [],
          audiences: [],
          locations: [],
        },
      }),
    );

    expect(view.statusLabel).toBe("Confirmed · a newer crawl is available");
    expect(view.narrative).toContain("Foundfy helps people get found in search.");
  });

  it("keeps multiple confirmed selcuk-style services in the narrative", () => {
    const view = buildSiteInterpretationView(
      model({
        websiteId: "a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2",
        status: "confirmed",
        confirmed: {
          confirmedAt: "2026-11-03T10:00:00.000Z",
          sourceInterpretationGeneratedAt: "2026-11-01T12:00:00.000Z",
          sourceGenerator: "heuristic",
          evidenceHash: "hash-selcuk",
          sourceCrawlRunId: "run-selcuk",
          siteDescription: "Selcuk Demirci makes films for artists and brands.",
          offers: ["Wedding films", "Commercial work"],
          audiences: ["artists", "brands"],
          locations: [],
        },
      }),
    );

    expect(view.fields.offers).toEqual(["Wedding films", "Commercial work"]);
    expect(view.narrative).toContain("Wedding films; Commercial work");
    expect(view.canEdit).toBe(true);
  });
});
