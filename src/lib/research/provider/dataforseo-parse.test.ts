import { describe, expect, it } from "vitest";
import { ResearchGateError, ResearchProviderError } from "../errors";
import { selectResearchCountry } from "../countries";
import { researchLanguageCandidates, selectResearchLanguages } from "../languages";
import {
  buildKeywordsForKeywordsTask,
  parseKeywordsForKeywordsResponse,
  parseLanguagesResponse,
  parseLocationsResponse,
} from "./dataforseo-parse";

const US_COUNTRY_ROW = {
  location_code: 2840,
  location_name: "United States",
  country_iso_code: "US",
  location_type: "Country",
};

const US_CITY_ROW = {
  location_code: 1014221,
  location_name: "New York,New York,United States",
  country_iso_code: "US",
  location_type: "City",
};

const ES_COUNTRY_ROW = {
  location_code: 2724,
  location_name: "Spain",
  country_iso_code: "ES",
  location_type: "Country",
};

function locationsEnvelope(result: unknown, extra?: { top?: unknown; task?: unknown }) {
  return {
    status_code: extra?.top ?? 20000,
    tasks: [
      {
        status_code: extra?.task ?? 20000,
        result,
      },
    ],
  };
}

function languagesEnvelope(result: unknown, extra?: { top?: unknown; task?: unknown }) {
  return {
    status_code: extra?.top ?? 20000,
    tasks: [
      {
        status_code: extra?.task ?? 20000,
        result,
      },
    ],
  };
}

describe("DataForSEO RESEARCH parser", () => {
  it("builds one seed, one country, one language, search_partners false, sort_by search_volume", () => {
    expect(
      buildKeywordsForKeywordsTask({
        offering: "silk paint",
        locationCode: 2724,
        languageCode: "ca",
      }),
    ).toEqual({
      keywords: ["silk paint"],
      location_code: 2724,
      language_code: "ca",
      search_partners: false,
      sort_by: "search_volume",
    });
  });

  it("parses task id, nullable search volume, and skips CPC/bids", () => {
    const parsed = parseKeywordsForKeywordsResponse({
      tasks: [
        {
          id: "task-123",
          status_code: 20000,
          cost: 0.075,
          result: [
            { keyword: "fixture related term", search_volume: 40, cpc: 1.2, competition: "HIGH" },
            { keyword: "fixture related none", search_volume: null },
          ],
        },
      ],
    });
    expect(parsed.taskId).toBe("task-123");
    expect(parsed.providerCost).toBe(0.075);
    expect(parsed.ideas[0]).toEqual({
      keyword: "fixture related term",
      searchVolume: 40,
      providerOrder: 0,
    });
    expect(parsed.ideas[1]?.searchVolume).toBeNull();
    expect(parsed.providerResultCount).toBe(2);
    expect(JSON.stringify(parsed)).not.toMatch(/cpc|competition/i);
  });

  it("treats a valid empty result as genuine provider empty", () => {
    const parsed = parseKeywordsForKeywordsResponse({
      status_code: 20000,
      tasks: [
        {
          id: "empty-task",
          status_code: 20000,
          cost: 0.09,
          result: [],
        },
      ],
    });
    expect(parsed.ideas).toEqual([]);
    expect(parsed.providerResultCount).toBe(0);
    expect(parsed.taskId).toBe("empty-task");
    expect(parsed.providerCost).toBe(0.09);
  });

  it("keeps a seed-only row so filtering can distinguish it from genuine empty", () => {
    const parsed = parseKeywordsForKeywordsResponse({
      status_code: 20000,
      tasks: [
        {
          id: "10132259-2775-0368-0000-fceca571f57f",
          status_code: 20000,
          cost: 0.09,
          result: [{ keyword: "SEO audit for small businesses", search_volume: 10 }],
        },
      ],
    });
    expect(parsed.providerResultCount).toBe(1);
    expect(parsed.ideas).toEqual([
      {
        keyword: "SEO audit for small businesses",
        searchVolume: 10,
        providerOrder: 0,
      },
    ]);
  });

  it.each([
    ["missing result", { status_code: 20000, tasks: [{ id: "t", status_code: 20000 }] }],
    ["null result", { status_code: 20000, tasks: [{ id: "t", status_code: 20000, result: null }] }],
    [
      "non-array result",
      { status_code: 20000, tasks: [{ id: "t", status_code: 20000, result: { keyword: "x" } }] },
    ],
    [
      "malformed keyword row",
      { status_code: 20000, tasks: [{ id: "t", status_code: 20000, result: [{ search_volume: 10 }] }] },
    ],
    [
      "non-object keyword row",
      { status_code: 20000, tasks: [{ id: "t", status_code: 20000, result: ["seo audit"] }] },
    ],
    ["missing tasks", { status_code: 20000 }],
    ["empty tasks", { status_code: 20000, tasks: [] }],
    ["top-level provider error", { status_code: 40100, status_message: "Unauthorized.", tasks: [] }],
    [
      "task provider error",
      { status_code: 20000, tasks: [{ id: "t", status_code: 40100, result: [] }] },
    ],
    [
      "task rate limit",
      { status_code: 20000, tasks: [{ id: "t", status_code: 40202, result: [] }] },
    ],
  ])("throws a provider error for %s and does not become empty ideas", (_label, payload) => {
    expect(() => parseKeywordsForKeywordsResponse(payload)).toThrow(ResearchProviderError);
    try {
      parseKeywordsForKeywordsResponse(payload);
    } catch (error) {
      expect(error).toBeInstanceOf(ResearchProviderError);
      expect((error as ResearchProviderError).code).not.toBe("live_not_enabled");
      expect(JSON.stringify(error)).not.toMatch(/zero_results/);
    }
  });
});

describe("DataForSEO locations metadata parser", () => {
  it("parses when provider status_code is absent but tasks[0].result is valid", () => {
    expect(
      parseLocationsResponse({
        tasks: [{ result: [US_CITY_ROW, US_COUNTRY_ROW] }],
      }),
    ).toEqual([{ key: "US", name: "United States", locationCode: 2840 }]);
  });

  it("keeps owner ISO US and resolves the Country row dynamically from tasks[0].result", () => {
    const countries = parseLocationsResponse(
      locationsEnvelope([
        US_CITY_ROW,
        US_COUNTRY_ROW,
        ES_COUNTRY_ROW,
        {
          location_code: 2016,
          location_name: "American Samoa",
          country_iso_code: "AS",
          location_type: "Country",
        },
      ]),
    );
    const unitedStates = selectResearchCountry({ selected: "US", countries });
    expect(unitedStates.key).toBe("US");
    expect(unitedStates.name).toBe("United States");
    expect(unitedStates.locationCode).toBe(US_COUNTRY_ROW.location_code);
    expect(countries.find((country) => country.key === "US")?.locationCode).not.toBe(
      US_CITY_ROW.location_code,
    );
  });

  it("normalizes location_type case and country_iso_code when selecting Country rows", () => {
    const countries = parseLocationsResponse(
      locationsEnvelope([
        {
          location_code: 2840,
          location_name: "United States",
          country_iso_code: " us ",
          location_type: "COUNTRY",
        },
        {
          location_code: 2724,
          location_name: "Spain",
          country_iso_code: "es",
          location_type: "country",
        },
      ]),
    );
    expect(countries.map((country) => country.key).sort()).toEqual(["ES", "US"]);
  });

  it("skips empty location_type and non-Country rows", () => {
    const countries = parseLocationsResponse(
      locationsEnvelope([
        {
          location_code: 2840,
          location_name: "United States",
          country_iso_code: "US",
          location_type: "",
        },
        US_CITY_ROW,
        ES_COUNTRY_ROW,
      ]),
    );
    expect(countries).toEqual([{ key: "ES", name: "Spain", locationCode: 2724 }]);
  });

  it("returns invalid_country only when a valid Country list lacks the selected ISO", () => {
    const countries = parseLocationsResponse(locationsEnvelope([ES_COUNTRY_ROW]));
    expect(() => selectResearchCountry({ selected: "US", countries })).toThrow(ResearchGateError);
    try {
      selectResearchCountry({ selected: "US", countries });
    } catch (error) {
      expect(error).toMatchObject({ name: "ResearchGateError", code: "invalid_country" });
    }
  });

  it("does not coerce numeric-string location_code", () => {
    expect(() =>
      parseLocationsResponse(
        locationsEnvelope([
          {
            location_code: "2840",
            location_name: "United States",
            country_iso_code: "US",
            location_type: "Country",
          },
        ]),
      ),
    ).toThrow(ResearchProviderError);
  });

  it.each([
    ["missing payload", null],
    ["missing tasks", { status_code: 20000 }],
    ["empty tasks", { status_code: 20000, tasks: [] }],
    ["missing result", { status_code: 20000, tasks: [{ status_code: 20000 }] }],
    ["null result", { status_code: 20000, tasks: [{ status_code: 20000, result: null }] }],
    ["malformed result", { status_code: 20000, tasks: [{ status_code: 20000, result: { location_code: 2840 } }] }],
    ["empty result", locationsEnvelope([])],
    ["top-level provider error", { status_code: 40100, status_message: "Unauthorized.", tasks: [] }],
    [
      "task-level provider error",
      locationsEnvelope([US_COUNTRY_ROW], { task: 40100 }),
    ],
    ["task rate limit", locationsEnvelope([US_COUNTRY_ROW], { task: 40202 })],
  ])("throws a provider error for %s", (_label, payload) => {
    expect(() => parseLocationsResponse(payload)).toThrow(ResearchProviderError);
    try {
      parseLocationsResponse(payload);
    } catch (error) {
      expect(error).toBeInstanceOf(ResearchProviderError);
      expect((error as ResearchProviderError).code).not.toBe("live_not_enabled");
      expect(JSON.stringify(error)).not.toMatch(/invalid_country/);
    }
  });
});

describe("DataForSEO languages metadata parser", () => {
  it("resolves en from a production-shaped language envelope", () => {
    const languages = parseLanguagesResponse(
      languagesEnvelope([
        { language_code: "ES", language_name: "Spanish" },
        { language_code: "en", language_name: "English" },
      ]),
    );
    expect(selectResearchLanguages({ selected: ["en"], candidates: languages })).toEqual(["en"]);
  });

  it("keeps unsupported_language when a valid list genuinely lacks en", () => {
    const languages = parseLanguagesResponse(
      languagesEnvelope([{ language_code: "es", language_name: "Spanish" }]),
    );
    const candidates = researchLanguageCandidates({
      htmlLangs: ["en"],
      supported: languages,
    });
    expect(() => selectResearchLanguages({ selected: ["en"], candidates })).toThrow(
      /observed on this site|supported site language/,
    );
    try {
      selectResearchLanguages({ selected: ["en"], candidates });
    } catch (error) {
      expect(error).toMatchObject({ name: "ResearchGateError", code: "unsupported_language" });
    }
  });

  it.each([
    ["missing tasks", { status_code: 20000 }],
    ["empty tasks", { status_code: 20000, tasks: [] }],
    ["missing result", { status_code: 20000, tasks: [{ status_code: 20000 }] }],
    ["empty result", languagesEnvelope([])],
    ["malformed result", { status_code: 20000, tasks: [{ status_code: 20000, result: "en" }] }],
    ["task-level provider error", languagesEnvelope([{ language_code: "en" }], { task: 40100 })],
    ["unusable rows", languagesEnvelope([{ language_code: "english" }])],
  ])("throws a provider error for %s", (_label, payload) => {
    expect(() => parseLanguagesResponse(payload)).toThrow(ResearchProviderError);
    try {
      parseLanguagesResponse(payload);
    } catch (error) {
      expect((error as ResearchProviderError).name).toBe("ResearchProviderError");
      expect(JSON.stringify(error)).not.toMatch(/unsupported_language/);
    }
  });
});
