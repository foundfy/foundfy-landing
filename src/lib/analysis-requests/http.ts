import {
  DAILY_CRAWL_LIMIT_STATUS,
  isDailyCrawlLimitReachedError,
} from "@/lib/crawler/daily-crawl-limit";
import { observeErrorResponse, observeJson } from "@/lib/gsc/http";
import { ObserveAuthError } from "@/lib/gsc/types";
import { AnalysisRequestError } from "./types";

export function analysisRequestErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AnalysisRequestError) {
    return observeJson({ error: error.message, reason: error.code }, error.status);
  }

  if (error instanceof ObserveAuthError) {
    return observeJson({ error: error.message }, error.status);
  }

  if (isDailyCrawlLimitReachedError(error)) {
    return observeJson({ error: error.message }, DAILY_CRAWL_LIMIT_STATUS);
  }

  return observeErrorResponse(error, fallback);
}
