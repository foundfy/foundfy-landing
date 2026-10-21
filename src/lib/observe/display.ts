export const OBSERVE_STALE_SOURCE_COPY =
  "Your site has a newer crawl. Check existing pages again first.";
export const OBSERVE_NO_CANDIDATES_COPY =
  "Foundfy did not find a discovered URL that is eligible to observe.";
export const OBSERVE_THIS_PAGE_LABEL = "Observe this page";
export const OBSERVE_OBSERVED_COPY = "Observed this page";
export const OBSERVE_CHECK_AGAIN_LABEL = "Check again";
export const OBSERVE_ALREADY_RUNNING_COPY =
  "Foundfy is already observing a page on this site.";
export const OBSERVE_CANDIDATE_INVALID_COPY =
  "That page is no longer eligible to observe.";
export const OBSERVE_ROBOTS_COPY = "Foundfy cannot fetch that page.";
export const OBSERVE_TIMEOUT_COPY = "Foundfy could not load that page in time.";
export const OBSERVE_FETCH_FAILED_COPY = "Foundfy could not load that page.";
export const OBSERVE_REDIRECT_DENIED_COPY =
  "Foundfy stopped because that page redirected off-site.";
export const OBSERVE_NON_HTML_COPY = "Foundfy can only check an HTML page.";
export const OBSERVE_INTERRUPTED_COPY =
  "The previous check was interrupted. You can try again.";
export const OBSERVE_T1_REJECTED_COPY =
  "Foundfy could not save this check. Check existing pages again first.";
export const OBSERVE_NOT_ELIGIBLE_COPY =
  "Foundfy can observe a discovered page only after it did not find an obvious match in the current crawl.";

export const OBSERVE_REASON_EXACT_PHRASE =
  "The URL contains the exact related-search phrase.";
export const OBSERVE_REASON_EXACT_WORDS =
  "The URL contains exact words from the related search.";
export const OBSERVE_REASON_SEED_OFFERING =
  "The URL contains exact words from the confirmed offering.";
export const OBSERVE_REASON_ANCHOR =
  "A fetched page links here using the related-search words.";
export const OBSERVE_REASON_GSC_SUPPORT =
  "Google Search already associates this discovered URL with this related search.";

export const OBSERVE_FAILURE_REASONS = {
  interrupted: "interrupted",
  robots_disallow: "robots_disallow",
  redirect_denied: "redirect_denied",
  fetch_timeout: "fetch_timeout",
  fetch_failed: "fetch_failed",
  non_html: "non_html",
} as const;

export function observeFailureCopy(reason: string | null | undefined): string {
  switch (reason) {
    case OBSERVE_FAILURE_REASONS.interrupted:
      return OBSERVE_INTERRUPTED_COPY;
    case OBSERVE_FAILURE_REASONS.robots_disallow:
      return OBSERVE_ROBOTS_COPY;
    case OBSERVE_FAILURE_REASONS.redirect_denied:
      return OBSERVE_REDIRECT_DENIED_COPY;
    case OBSERVE_FAILURE_REASONS.fetch_timeout:
      return OBSERVE_TIMEOUT_COPY;
    case OBSERVE_FAILURE_REASONS.non_html:
      return OBSERVE_NON_HTML_COPY;
    default:
      return OBSERVE_FETCH_FAILED_COPY;
  }
}
