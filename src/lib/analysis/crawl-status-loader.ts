import type { CrawlStatusPayload } from "@/lib/analysis/crawl-status";
import { resolveCrawlPollOutcome } from "@/lib/analysis/crawl-poll-outcome";

export type CrawlRunViewPhase =
  | "loading"
  | "not_found"
  | "error"
  | "analyzing"
  | "completed"
  | "failed";

export type CrawlStatusViewState = {
  phase: CrawlRunViewPhase;
  payload: CrawlStatusPayload | null;
  errorMessage: string | null;
};

export function resolveInitialCrawlViewPhase(input: {
  status: CrawlStatusPayload["status"];
  httpStatus: number;
}): Pick<CrawlStatusViewState, "phase" | "errorMessage"> {
  if (input.httpStatus === 404) {
    return { phase: "not_found", errorMessage: "Scan not found." };
  }

  if (input.httpStatus >= 400) {
    return {
      phase: "error",
      errorMessage: "Unable to load this scan right now.",
    };
  }

  const outcome = resolveCrawlPollOutcome(input.status);

  if (outcome === "failed") {
    return {
      phase: "failed",
      errorMessage: null,
    };
  }

  if (outcome === "completed") {
    return { phase: "completed", errorMessage: null };
  }

  return { phase: "analyzing", errorMessage: null };
}

export function resolvePollTransition(
  status: CrawlStatusPayload["status"],
): "continue" | "completed" | "failed" {
  return resolveCrawlPollOutcome(status);
}

export function shouldPollExplanationEnrichment(
  payload: CrawlStatusPayload,
): boolean {
  if (payload.status !== "completed") {
    return false;
  }

  if (!payload.findingsSummary?.highlightedFindingIds.length) {
    return false;
  }

  const enrichmentStatus = payload.explanationEnrichmentStatus;
  return (
    enrichmentStatus === "pending" ||
    enrichmentStatus === undefined
  );
}

export function mergeCrawlStatusPayload(
  current: CrawlStatusPayload | null,
  next: CrawlStatusPayload,
): CrawlStatusPayload {
  return {
    ...current,
    ...next,
    findings: next.findings ?? current?.findings,
    findingsSummary: next.findingsSummary ?? current?.findingsSummary,
    comparison: next.comparison ?? current?.comparison,
    searchPresence: next.searchPresence ?? current?.searchPresence,
  };
}
