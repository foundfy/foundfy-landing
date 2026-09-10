"use client";

import { useEffect, useRef } from "react";
import type { CrawlStatusPayload } from "@/lib/analysis/crawl-status";
import { useAnalysis } from "@/contexts/AnalysisContext";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 10;

const FETCH_OPTIONS: RequestInit = {
  cache: "no-store",
};

export function useExplanationEnrichmentPolling() {
  const { phase, crawlRunId, findingsSummary, updateCrawlProgress } =
    useAnalysis();
  const pollCountRef = useRef(0);

  useEffect(() => {
    if (phase !== "completed" || !crawlRunId || !findingsSummary) {
      pollCountRef.current = 0;
      return;
    }

    if (findingsSummary.highlightedFindingIds.length === 0) {
      return;
    }

    let cancelled = false;

    async function pollForEnrichment() {
      while (!cancelled && pollCountRef.current < MAX_POLLS) {
        pollCountRef.current += 1;

        try {
          const response = await fetch(
            `/api/crawl/${crawlRunId}`,
            FETCH_OPTIONS,
          );
          const payload = (await response.json()) as CrawlStatusPayload;

          if (!response.ok || !payload.findings) {
            return;
          }

          updateCrawlProgress({
            status: payload.status,
            findings: payload.findings,
            findingsSummary: payload.findingsSummary,
            explanationEnrichmentStatus: payload.explanationEnrichmentStatus,
          });

          if (
            payload.explanationEnrichmentStatus === "ready" ||
            payload.explanationEnrichmentStatus === "failed" ||
            payload.explanationEnrichmentStatus === "skipped" ||
            payload.explanationEnrichmentStatus === "disabled"
          ) {
            return;
          }
        } catch {
          return;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, POLL_INTERVAL_MS);
        });
      }
    }

    void pollForEnrichment();

    return () => {
      cancelled = true;
    };
  }, [phase, crawlRunId, findingsSummary, updateCrawlProgress]);
}
