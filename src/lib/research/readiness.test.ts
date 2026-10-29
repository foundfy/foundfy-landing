import { describe, expect, it } from "vitest";
import { evaluateResearchReadiness } from "./readiness";
import type { SiteModelRecord } from "@/lib/site-model/types";

function model(overrides: Partial<SiteModelRecord> = {}): SiteModelRecord {
  return {
    id: "model-1",
    websiteId: "site-1",
    sourceCrawlRunId: "crawl-1",
    version: 1,
    status: "stale",
    understanding: {
      derivationVersion: 1,
      hostname: "dbhobby.com",
      seedUrl: "https://dbhobby.com/",
      sample: {
        pagesCrawled: 10,
        pagesDiscovered: 10,
        maxPages: 10,
        fetchedHttp200Count: 10,
        sampleIsCapped: true,
        fetchedEveryDiscoveredHtmlPage: false,
      },
      pageTypeCounts: [],
      pages: [],
      languages: { htmlLangs: ["ca", "es"], urlLocales: ["ca", "es"] },
      navigationLabels: [],
      jsonLdTypes: [],
      jsonLdPropertyCount: 0,
      siteDiscovery: { robots: null, sitemaps: [] },
    },
    interpretation: null,
    confirmed: {
      confirmedAt: "2026-09-28T00:00:00.000Z",
      sourceInterpretationGeneratedAt: "2026-09-24T00:00:00.000Z",
      sourceGenerator: "heuristic",
      evidenceHash: "hash",
      sourceCrawlRunId: "crawl-old",
      siteDescription: "A shop.",
      offers: ["silk paint"],
      audiences: [],
      locations: ["Barcelona"],
    },
    evidence: {
      source: "crawl",
      websiteId: "site-1",
      crawlRunId: "crawl-1",
      pageIds: [],
      artifactIds: [],
      fields: [],
    },
    derivedAt: "2026-09-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("RESEARCH readiness", () => {
  it("allows stale Site Models that still have a confirmed payload", () => {
    const readiness = evaluateResearchReadiness({
      model: model(),
      hasCompletedGscSync: true,
      env: { RESEARCH_PROVIDER_MODE: "fixture" },
    });
    expect(readiness.gate).toBeNull();
    expect(readiness.validOfferings).toEqual(["silk paint"]);
    expect(readiness.executionAvailable).toBe(true);
    expect(readiness.surfaceVisible).toBe(true);
  });

  it("keeps persisted RESEARCH visible in production when live execution is disabled", () => {
    const readiness = evaluateResearchReadiness({
      model: model(),
      hasCompletedGscSync: true,
      env: {
        NODE_ENV: "production",
        RESEARCH_PROVIDER_MODE: "live",
        RESEARCH_LIVE_ENABLED: "false",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
      },
    });
    expect(readiness.surfaceVisible).toBe(true);
    expect(readiness.executionAvailable).toBe(false);
    expect(readiness.gate?.code).toBe("live_not_enabled");
  });

  it("does not reuse Site Model locations as the research country", () => {
    const readiness = evaluateResearchReadiness({
      model: model(),
      hasCompletedGscSync: true,
      env: { RESEARCH_PROVIDER_MODE: "fixture" },
    });
    expect(readiness.countries.some((country) => country.name === "Barcelona")).toBe(false);
    expect(readiness.countries.some((country) => country.key === "ES")).toBe(true);
  });

  it("fails closed without confirmed payload or offerings, but not solely for missing GSC", () => {
    expect(
      evaluateResearchReadiness({
        model: null,
        hasCompletedGscSync: true,
        env: { RESEARCH_PROVIDER_MODE: "fixture" },
      }).gate?.code,
    ).toBe("no_confirmed_site_model");

    expect(
      evaluateResearchReadiness({
        model: model({
          confirmed: {
            confirmedAt: "2026-09-28T00:00:00.000Z",
            sourceInterpretationGeneratedAt: "2026-09-24T00:00:00.000Z",
            sourceGenerator: "heuristic",
            evidenceHash: "hash",
            sourceCrawlRunId: "crawl-old",
            siteDescription: "A shop.",
            offers: [],
            audiences: [],
            locations: [],
          },
        }),
        hasCompletedGscSync: true,
        env: { RESEARCH_PROVIDER_MODE: "fixture" },
      }).gate?.code,
    ).toBe("no_valid_offering");

    const fixtureNoGsc = evaluateResearchReadiness({
      model: model(),
      hasCompletedGscSync: false,
      env: { RESEARCH_PROVIDER_MODE: "fixture" },
    });
    expect(fixtureNoGsc.gate).toBeNull();
    expect(fixtureNoGsc.executionAvailable).toBe(true);
    expect(fixtureNoGsc.hasCompletedGscSync).toBe(false);
  });

  it("does not present unauthorized live no-GSC research as executable", () => {
    const websiteId = "11111111-1111-4111-8111-111111111111";
    const googleIdentityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const liveEnv = {
      RESEARCH_PROVIDER_MODE: "live",
      RESEARCH_LIVE_ENABLED: "true",
      DATAFORSEO_LOGIN: "login",
      DATAFORSEO_PASSWORD: "password",
    };
    const denied = evaluateResearchReadiness({
      model: model(),
      hasCompletedGscSync: false,
      websiteId,
      googleIdentityId,
      env: liveEnv,
    });
    expect(denied.gate?.code).toBe("no_gsc_live_not_authorized");
    expect(denied.executionAvailable).toBe(false);
    expect(denied.surfaceVisible).toBe(true);

    const allowed = evaluateResearchReadiness({
      model: model(),
      hasCompletedGscSync: false,
      websiteId,
      googleIdentityId,
      env: {
        ...liveEnv,
        RESEARCH_NO_GSC_LIVE_ALLOWLIST: `${websiteId}:${googleIdentityId}`,
      },
    });
    expect(allowed.gate).toBeNull();
    expect(allowed.executionAvailable).toBe(true);
  });
});
