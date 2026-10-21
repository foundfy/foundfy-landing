import { saveParsedPage } from "@/lib/crawler/db/repository";
import { parseHtmlPage } from "@/lib/crawler/parse/page";
import {
  SsrfValidationError,
  targetedObserveFetch,
} from "@/lib/crawler/security/targeted-observe-fetch";
import { OBSERVE_FAILURE_REASONS } from "./display";
import { robotsAllowsQueueUrl } from "./candidates";
import { loadSourceRobotsArtifact } from "./db";

export class TargetedObserveFetchError extends Error {
  readonly reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.name = "TargetedObserveFetchError";
    this.reason = reason;
  }
}

export async function fetchAndSaveTargetedPage(input: {
  websiteId: string;
  hostname: string;
  sourceCrawlRunId: string;
  targetedCrawlRunId: string;
  requestedUrl: string;
  startedAt: string;
}): Promise<string> {
  const robots = await loadSourceRobotsArtifact(input.sourceCrawlRunId);
  if (!robotsAllowsQueueUrl(input.requestedUrl, robots)) {
    throw new TargetedObserveFetchError(
      OBSERVE_FAILURE_REASONS.robots_disallow,
      "Foundfy cannot fetch that page.",
    );
  }

  let fetched;
  try {
    fetched = await targetedObserveFetch(input.requestedUrl, input.hostname, {
      startedAt: input.startedAt,
    });
  } catch (error) {
    if (error instanceof SsrfValidationError) {
      if (error.message.includes("timed out")) {
        throw new TargetedObserveFetchError(
          OBSERVE_FAILURE_REASONS.fetch_timeout,
          error.message,
        );
      }
      if (
        error.message.includes("same-site") ||
        error.message.includes("downgrade") ||
        error.message.includes("Redirect")
      ) {
        throw new TargetedObserveFetchError(
          OBSERVE_FAILURE_REASONS.redirect_denied,
          error.message,
        );
      }
      throw new TargetedObserveFetchError(OBSERVE_FAILURE_REASONS.fetch_failed, error.message);
    }
    throw new TargetedObserveFetchError(
      OBSERVE_FAILURE_REASONS.fetch_failed,
      error instanceof Error ? error.message : "Fetch failed",
    );
  }

  const contentType = fetched.headers["content-type"] ?? "";
  if (!contentType.includes("text/html") && !fetched.body.includes("<html")) {
    throw new TargetedObserveFetchError(
      OBSERVE_FAILURE_REASONS.non_html,
      "Foundfy can only check an HTML page.",
    );
  }

  const parsed = parseHtmlPage(fetched, input.hostname);
  return saveParsedPage({
    crawlRunId: input.targetedCrawlRunId,
    websiteId: input.websiteId,
    parsed,
  });
}
