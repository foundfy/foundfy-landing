import { describe, expect, it } from "vitest";
import {
  buildKeywordsForKeywordsTask,
  parseKeywordsForKeywordsResponse,
  parseLanguagesResponse,
  parseLocationsResponse,
} from "./dataforseo-parse";

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
    expect(JSON.stringify(parsed)).not.toMatch(/cpc|competition/i);
  });

  it("parses country and language metadata from provider payloads", () => {
    const countries = parseLocationsResponse({
      tasks: [
        {
          result: [
            {
              location_code: 2724,
              location_name: "Spain",
              country_iso_code: "ES",
              location_type: "Country",
            },
            {
              location_code: 1006886,
              location_name: "Barcelona,Catalonia,Spain",
              country_iso_code: "ES",
              location_type: "City",
            },
          ],
        },
      ],
    });
    expect(countries).toEqual([{ key: "ES", name: "Spain", locationCode: 2724 }]);
    expect(
      parseLanguagesResponse({
        tasks: [{ result: [{ language_code: "ca", language_name: "Catalan" }] }],
      }),
    ).toEqual([{ code: "ca", name: "Catalan" }]);
  });
});
