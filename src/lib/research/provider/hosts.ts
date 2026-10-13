export const DATAFORSEO_SANDBOX_ORIGIN = "https://sandbox.dataforseo.com";
export const DATAFORSEO_LIVE_ORIGIN = "https://api.dataforseo.com";

export const DATAFORSEO_KEYWORDS_FOR_KEYWORDS_PATH =
  "/v3/keywords_data/google_ads/keywords_for_keywords/live";
export const DATAFORSEO_LOCATIONS_PATH = "/v3/keywords_data/google_ads/locations";
export const DATAFORSEO_LANGUAGES_PATH = "/v3/keywords_data/google_ads/languages";

export type DataForSeoRequestCategory =
  | "locations"
  | "languages"
  | "keywords_for_keywords"
  | "other";

export function dataForSeoRequestCategory(path: string): DataForSeoRequestCategory {
  if (path === DATAFORSEO_LOCATIONS_PATH) {
    return "locations";
  }

  if (path === DATAFORSEO_LANGUAGES_PATH) {
    return "languages";
  }

  if (path === DATAFORSEO_KEYWORDS_FOR_KEYWORDS_PATH) {
    return "keywords_for_keywords";
  }

  return "other";
}

export type DataForSeoOrigin =
  | typeof DATAFORSEO_SANDBOX_ORIGIN
  | typeof DATAFORSEO_LIVE_ORIGIN;

export function assertDataForSeoOrigin(origin: string): DataForSeoOrigin {
  if (origin === DATAFORSEO_SANDBOX_ORIGIN || origin === DATAFORSEO_LIVE_ORIGIN) {
    return origin;
  }

  throw new Error("DataForSEO host is locked and cannot be overridden.");
}

export function isLiveDataForSeoOrigin(origin: string): boolean {
  return origin === DATAFORSEO_LIVE_ORIGIN;
}
