export const CRAWL_RUN_PURPOSE_SITE_SAMPLE = "site_sample" as const;
export const CRAWL_RUN_PURPOSE_TARGETED_OBSERVE = "targeted_observe" as const;

export type CrawlRunPurpose =
  | typeof CRAWL_RUN_PURPOSE_SITE_SAMPLE
  | typeof CRAWL_RUN_PURPOSE_TARGETED_OBSERVE;

export function isSiteSamplePurpose(purpose: string | null | undefined): boolean {
  return purpose === CRAWL_RUN_PURPOSE_SITE_SAMPLE;
}

export function isNonSiteSamplePurpose(purpose: string | null | undefined): boolean {
  return purpose != null && purpose !== CRAWL_RUN_PURPOSE_SITE_SAMPLE;
}
