export const MAX_CONSECUTIVE_TRANSIENT_CRAWL_STATUS_FAILURES = 5;

const TRANSIENT_HTTP_STATUSES = new Set([500, 502, 503, 504]);

export function isTransientCrawlStatusHttpError(status: number): boolean {
  return TRANSIENT_HTTP_STATUSES.has(status);
}

export function isTerminalCrawlStatusHttpError(status: number): boolean {
  return status >= 400 && !isTransientCrawlStatusHttpError(status);
}

export function shouldRetryTransientCrawlStatusFailure(
  consecutiveFailures: number,
): boolean {
  return consecutiveFailures < MAX_CONSECUTIVE_TRANSIENT_CRAWL_STATUS_FAILURES;
}
