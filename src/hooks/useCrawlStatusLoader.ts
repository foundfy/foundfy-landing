"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  mergeCrawlStatusPayload,
  resolveInitialCrawlViewPhase,
  resolvePollTransition,
  shouldPollExplanationEnrichment,
  type CrawlRunViewPhase,
  type CrawlStatusViewState,
} from "@/lib/analysis/crawl-status-loader";
import { fetchCrawlStatus } from "@/lib/analysis/fetch-crawl-status";
import type { CrawlStatusPayload } from "@/lib/analysis/crawl-status";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;
const ENRICHMENT_POLL_INTERVAL_MS = 3000;
const ENRICHMENT_MAX_POLLS = 10;

export function useCrawlStatusLoader(crawlRunId: string) {
  const [state, setState] = useState<CrawlStatusViewState>({
    phase: "loading",
    payload: null,
    errorMessage: null,
  });
  const [loadedAsCompleted, setLoadedAsCompleted] = useState(false);

  const payloadRef = useRef<CrawlStatusPayload | null>(null);

  const applyPayload = useCallback((next: CrawlStatusPayload) => {
    payloadRef.current = mergeCrawlStatusPayload(payloadRef.current, next);
    setState((current) => ({
      ...current,
      payload: payloadRef.current,
    }));
  }, []);

  useEffect(() => {
    payloadRef.current = null;
    setLoadedAsCompleted(false);
    setState({
      phase: "loading",
      payload: null,
      errorMessage: null,
    });

    let cancelled = false;

    async function loadInitial() {
      try {
        const result = await fetchCrawlStatus(crawlRunId);

        if (cancelled) {
          return;
        }

        if (!result.ok) {
          const resolved = resolveInitialCrawlViewPhase({
            status: "failed",
            httpStatus: result.status,
          });
          setState({
            phase: resolved.phase,
            payload: null,
            errorMessage: result.error,
          });
          return;
        }

        applyPayload(result.payload);

        const resolved = resolveInitialCrawlViewPhase({
          status: result.payload.status,
          httpStatus: 200,
        });

        setLoadedAsCompleted(resolved.phase === "completed");
        setState({
          phase: resolved.phase,
          payload: payloadRef.current,
          errorMessage:
            resolved.phase === "failed"
              ? result.payload.errorMessage ?? "Crawl failed."
              : resolved.errorMessage,
        });
      } catch {
        if (!cancelled) {
          setState({
            phase: "error",
            payload: null,
            errorMessage: "Unable to load this scan right now.",
          });
        }
      }
    }

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, [applyPayload, crawlRunId]);

  useEffect(() => {
    if (state.phase !== "analyzing") {
      return;
    }

    let cancelled = false;
    const pollStartedAt = Date.now();

    async function pollStatus() {
      if (Date.now() - pollStartedAt >= POLL_TIMEOUT_MS) {
        if (!cancelled) {
          setState({
            phase: "error",
            payload: payloadRef.current,
            errorMessage:
              "Analysis is taking longer than expected. Please try again in a moment.",
          });
        }
        return false;
      }

      try {
        const result = await fetchCrawlStatus(crawlRunId);

        if (!result.ok) {
          if (!cancelled) {
            setState({
              phase: "error",
              payload: payloadRef.current,
              errorMessage: result.error,
            });
          }
          return false;
        }

        if (!cancelled) {
          applyPayload(result.payload);
        }

        const transition = resolvePollTransition(result.payload.status);

        if (transition === "completed") {
          if (!cancelled) {
            setState({
              phase: "completed",
              payload: payloadRef.current,
              errorMessage: null,
            });
          }
          return false;
        }

        if (transition === "failed") {
          if (!cancelled) {
            setState({
              phase: "failed",
              payload: payloadRef.current,
              errorMessage: result.payload.errorMessage ?? "Crawl failed.",
            });
          }
          return false;
        }

        return true;
      } catch {
        if (!cancelled) {
          setState({
            phase: "error",
            payload: payloadRef.current,
            errorMessage: "Unable to fetch crawl status.",
          });
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
  }, [applyPayload, crawlRunId, state.phase]);

  useEffect(() => {
    if (state.phase !== "completed" || !payloadRef.current) {
      return;
    }

    if (!shouldPollExplanationEnrichment(payloadRef.current)) {
      return;
    }

    let cancelled = false;
    let pollCount = 0;

    async function pollEnrichment() {
      while (!cancelled && pollCount < ENRICHMENT_MAX_POLLS) {
        pollCount += 1;

        try {
          const result = await fetchCrawlStatus(crawlRunId);

          if (!result.ok || !result.payload.findings) {
            return;
          }

          if (!cancelled) {
            applyPayload(result.payload);
            setState((current) => ({
              ...current,
              payload: payloadRef.current,
            }));
          }

          if (!shouldPollExplanationEnrichment(result.payload)) {
            return;
          }
        } catch {
          return;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, ENRICHMENT_POLL_INTERVAL_MS);
        });
      }
    }

    void pollEnrichment();

    return () => {
      cancelled = true;
    };
  }, [applyPayload, crawlRunId, state.phase, state.payload?.explanationEnrichmentStatus]);

  const markResultsReady = useCallback(() => {
    setState((current) => ({
      ...current,
      phase: "completed",
    }));
  }, []);

  return {
    ...state,
    loadedAsCompleted,
    markResultsReady,
  };
}

export type { CrawlRunViewPhase };
