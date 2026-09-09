"use client";

import { useEffect, useRef } from "react";
import { resolveCrawlPollOutcome } from "@/lib/analysis/crawl-poll-outcome";
import { useAnalysis } from "@/contexts/AnalysisContext";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

const FETCH_OPTIONS: RequestInit = {
  cache: "no-store",
};

type CrawlStatusResponse = {
  status: "queued" | "running" | "completed" | "failed";
  errorMessage?: string | null;
};

export function useCrawlPolling() {
  const {
    phase,
    domain,
    crawlRunId,
    setCrawlRunId,
    completeAnalysis,
    failAnalysis,
  } = useAnalysis();

  const completeAnalysisRef = useRef(completeAnalysis);
  const failAnalysisRef = useRef(failAnalysis);

  completeAnalysisRef.current = completeAnalysis;
  failAnalysisRef.current = failAnalysis;

  const domainUrl = domain?.url ?? null;

  useEffect(() => {
    if (phase !== "starting" || !domainUrl) {
      return;
    }

    let cancelled = false;
    const activeDomainUrl = domainUrl;

    async function startCrawl() {
      try {
        const response = await fetch("/api/crawl", {
          ...FETCH_OPTIONS,
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ url: activeDomainUrl }),
        });

        const payload = (await response.json()) as {
          crawlRunId?: string;
          error?: string;
        };

        if (!response.ok || !payload.crawlRunId) {
          if (!cancelled) {
            failAnalysisRef.current(
              payload.error ?? "Unable to start analysis.",
            );
          }
          return;
        }

        if (!cancelled) {
          setCrawlRunId(payload.crawlRunId);
        }
      } catch {
        if (!cancelled) {
          failAnalysisRef.current("Unable to start analysis.");
        }
      }
    }

    void startCrawl();

    return () => {
      cancelled = true;
    };
  }, [phase, domainUrl, setCrawlRunId]);

  useEffect(() => {
    if (phase !== "starting" || !crawlRunId) {
      return;
    }

    let cancelled = false;
    const activeCrawlRunId = crawlRunId;
    const pollStartedAt = Date.now();

    async function pollStatus() {
      if (Date.now() - pollStartedAt >= POLL_TIMEOUT_MS) {
        if (!cancelled) {
          failAnalysisRef.current(
            "Analysis is taking longer than expected. Please try again in a moment.",
          );
        }
        return false;
      }

      try {
        const response = await fetch(
          `/api/crawl/${activeCrawlRunId}`,
          FETCH_OPTIONS,
        );
        const payload = (await response.json()) as CrawlStatusResponse & {
          error?: string;
        };

        if (!response.ok) {
          if (!cancelled) {
            failAnalysisRef.current(
              payload.error ?? "Unable to fetch crawl status.",
            );
          }
          return false;
        }

        const outcome = resolveCrawlPollOutcome(payload.status);

        if (outcome === "completed") {
          if (!cancelled) {
            completeAnalysisRef.current();
          }
          return false;
        }

        if (outcome === "failed") {
          if (!cancelled) {
            failAnalysisRef.current(payload.errorMessage ?? "Crawl failed.");
          }
          return false;
        }

        return true;
      } catch {
        if (!cancelled) {
          failAnalysisRef.current("Unable to fetch crawl status.");
        }
        return false;
      }
    }

    void (async () => {
      let shouldContinue = await pollStatus();

      while (shouldContinue && !cancelled) {
        await new Promise((resolve) => {
          setTimeout(resolve, POLL_INTERVAL_MS);
        });
        shouldContinue = await pollStatus();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, crawlRunId]);
}
