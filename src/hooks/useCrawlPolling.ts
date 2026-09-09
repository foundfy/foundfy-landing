"use client";

import { useEffect, useRef } from "react";
import { useAnalysis } from "@/contexts/AnalysisContext";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

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
  const startedRef = useRef(false);

  useEffect(() => {
    if (phase !== "starting" || !domain) {
      startedRef.current = false;
      return;
    }

    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    const activeDomain = domain;
    let cancelled = false;

    async function startCrawl() {
      try {
        const response = await fetch("/api/crawl", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ url: activeDomain.url }),
        });

        const payload = (await response.json()) as {
          crawlRunId?: string;
          error?: string;
        };

        if (!response.ok || !payload.crawlRunId) {
          if (!cancelled) {
            failAnalysis(payload.error ?? "Unable to start analysis.");
          }
          return;
        }

        if (!cancelled) {
          setCrawlRunId(payload.crawlRunId);
        }
      } catch {
        if (!cancelled) {
          failAnalysis("Unable to start analysis.");
        }
      }
    }

    void startCrawl();

    return () => {
      cancelled = true;
    };
  }, [phase, domain, setCrawlRunId, failAnalysis]);

  useEffect(() => {
    if (phase !== "starting" || !crawlRunId) {
      return;
    }

    let cancelled = false;
    const pollStartedAt = Date.now();

    async function pollStatus() {
      if (Date.now() - pollStartedAt >= POLL_TIMEOUT_MS) {
        if (!cancelled) {
          failAnalysis(
            "Analysis is taking longer than expected. Please try again in a moment.",
          );
        }
        return false;
      }

      try {
        const response = await fetch(`/api/crawl/${crawlRunId}`);
        const payload = (await response.json()) as CrawlStatusResponse & {
          error?: string;
        };

        if (!response.ok) {
          if (!cancelled) {
            failAnalysis(payload.error ?? "Unable to fetch crawl status.");
          }
          return false;
        }

        if (payload.status === "completed") {
          if (!cancelled) {
            completeAnalysis();
          }
          return false;
        }

        if (payload.status === "failed") {
          if (!cancelled) {
            failAnalysis(payload.errorMessage ?? "Crawl failed.");
          }
          return false;
        }

        return true;
      } catch {
        if (!cancelled) {
          failAnalysis("Unable to fetch crawl status.");
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
  }, [phase, crawlRunId, completeAnalysis, failAnalysis]);
}
