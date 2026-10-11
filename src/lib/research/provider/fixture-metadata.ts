import type { ResearchCountry, ResearchLanguage } from "../types";

export const FIXTURE_RESEARCH_COUNTRIES: ResearchCountry[] = [
  { key: "AD", name: "Andorra", locationCode: 2020 },
  { key: "AR", name: "Argentina", locationCode: 2032 },
  { key: "AU", name: "Australia", locationCode: 2036 },
  { key: "CA", name: "Canada", locationCode: 2124 },
  { key: "CL", name: "Chile", locationCode: 2152 },
  { key: "CO", name: "Colombia", locationCode: 2170 },
  { key: "FR", name: "France", locationCode: 2250 },
  { key: "DE", name: "Germany", locationCode: 2276 },
  { key: "IE", name: "Ireland", locationCode: 2372 },
  { key: "IT", name: "Italy", locationCode: 2380 },
  { key: "MX", name: "Mexico", locationCode: 2484 },
  { key: "NL", name: "Netherlands", locationCode: 2528 },
  { key: "PE", name: "Peru", locationCode: 2604 },
  { key: "PT", name: "Portugal", locationCode: 2620 },
  { key: "ES", name: "Spain", locationCode: 2724 },
  { key: "GB", name: "United Kingdom", locationCode: 2826 },
  { key: "US", name: "United States", locationCode: 2840 },
];

export const FIXTURE_RESEARCH_LANGUAGES: ResearchLanguage[] = [
  { code: "ca", name: "Catalan" },
  { code: "de", name: "German" },
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
];
