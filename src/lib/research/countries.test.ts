import { describe, expect, it } from "vitest";
import { selectResearchCountry } from "./countries";
import { ResearchGateError, ResearchProviderError } from "./errors";
import { FIXTURE_RESEARCH_COUNTRIES } from "./provider/fixture-metadata";

describe("RESEARCH country selection", () => {
  it("requires an explicit closed-list country and never infers worldwide", () => {
    expect(() =>
      selectResearchCountry({ selected: undefined, countries: FIXTURE_RESEARCH_COUNTRIES }),
    ).toThrow(/Choose the country/);
    expect(() =>
      selectResearchCountry({ selected: "", countries: FIXTURE_RESEARCH_COUNTRIES }),
    ).toThrow(/Choose the country/);
    expect(() =>
      selectResearchCountry({ selected: "XX", countries: FIXTURE_RESEARCH_COUNTRIES }),
    ).toThrow(/Choose a country Foundfy can research/);
  });

  it("maps a selected country key through provider metadata rather than Site Model locations", () => {
    const spain = selectResearchCountry({
      selected: "es",
      countries: FIXTURE_RESEARCH_COUNTRIES,
    });
    expect(spain.key).toBe("ES");
    expect(spain.locationCode).toBe(2724);
    expect(FIXTURE_RESEARCH_COUNTRIES.some((country) => country.key === "locations")).toBe(false);
  });

  it("keeps owner-selected US as ISO US against a valid Country list", () => {
    const unitedStates = selectResearchCountry({
      selected: "US",
      countries: FIXTURE_RESEARCH_COUNTRIES,
    });
    expect(unitedStates.key).toBe("US");
    expect(unitedStates.name).toBe("United States");
  });

  it("does not treat unusable empty metadata as invalid_country", () => {
    expect(() => selectResearchCountry({ selected: "US", countries: [] })).toThrow(
      ResearchProviderError,
    );
    try {
      selectResearchCountry({ selected: "US", countries: [] });
    } catch (error) {
      expect(error).toBeInstanceOf(ResearchProviderError);
      expect(error).not.toBeInstanceOf(ResearchGateError);
    }
  });
});
