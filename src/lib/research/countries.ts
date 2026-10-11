import { ResearchGateError } from "./errors";
import type { ResearchCountry } from "./types";

export function selectResearchCountry(input: {
  selected: string | undefined;
  countries: ResearchCountry[];
}): ResearchCountry {
  const key = input.selected?.trim().toUpperCase() ?? "";
  if (!key) {
    throw new ResearchGateError(
      "no_research_country",
      "Choose the country you want Foundfy to research.",
      400,
    );
  }

  const match = input.countries.find((country) => country.key === key);
  if (!match) {
    throw new ResearchGateError(
      "invalid_country",
      "Choose a country Foundfy can research.",
      400,
    );
  }

  return match;
}
