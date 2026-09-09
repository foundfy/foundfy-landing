"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { NormalizedDomain } from "@/lib/analysis/domain";
import type {
  AnalysisObservation,
  CrawlLifecycleStatus,
} from "@/lib/analysis/crawl-status";

export type AnalysisPhase = "idle" | "starting" | "completed" | "failed";

type CompleteAnalysisInput = {
  observations: AnalysisObservation[];
};

type AnalysisContextValue = {
  domain: NormalizedDomain | null;
  phase: AnalysisPhase;
  crawlRunId: string | null;
  crawlStatus: CrawlLifecycleStatus | null;
  pagesCrawled: number;
  maxPages: number;
  observations: AnalysisObservation[];
  errorMessage: string | null;
  startAnalysis: (domain: NormalizedDomain) => void;
  setCrawlRunId: (crawlRunId: string) => void;
  updateCrawlProgress: (input: {
    status: CrawlLifecycleStatus;
    pagesCrawled?: number;
    maxPages?: number;
    observations?: AnalysisObservation[];
  }) => void;
  completeAnalysis: (input: CompleteAnalysisInput) => void;
  failAnalysis: (message: string) => void;
  resetAnalysis: () => void;
};

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [domain, setDomain] = useState<NormalizedDomain | null>(null);
  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [crawlRunId, setCrawlRunIdState] = useState<string | null>(null);
  const [crawlStatus, setCrawlStatus] = useState<CrawlLifecycleStatus | null>(
    null,
  );
  const [pagesCrawled, setPagesCrawled] = useState(0);
  const [maxPages, setMaxPages] = useState(0);
  const [observations, setObservations] = useState<AnalysisObservation[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startAnalysis = useCallback((nextDomain: NormalizedDomain) => {
    setDomain(nextDomain);
    setPhase("starting");
    setCrawlRunIdState(null);
    setCrawlStatus("queued");
    setPagesCrawled(0);
    setMaxPages(0);
    setObservations([]);
    setErrorMessage(null);
  }, []);

  const setCrawlRunId = useCallback((nextCrawlRunId: string) => {
    setCrawlRunIdState(nextCrawlRunId);
  }, []);

  const updateCrawlProgress = useCallback(
    (input: {
      status: CrawlLifecycleStatus;
      pagesCrawled?: number;
      maxPages?: number;
      observations?: AnalysisObservation[];
    }) => {
      setCrawlStatus(input.status);

      if (typeof input.pagesCrawled === "number") {
        setPagesCrawled(input.pagesCrawled);
      }

      if (typeof input.maxPages === "number") {
        setMaxPages(input.maxPages);
      }

      if (input.observations) {
        setObservations(input.observations);
      }
    },
    [],
  );

  const completeAnalysis = useCallback((input: CompleteAnalysisInput) => {
    setPhase("completed");
    setCrawlStatus("completed");
    setObservations(input.observations);
    setErrorMessage(null);
  }, []);

  const failAnalysis = useCallback((message: string) => {
    setPhase("failed");
    setErrorMessage(message);
  }, []);

  const resetAnalysis = useCallback(() => {
    setDomain(null);
    setPhase("idle");
    setCrawlRunIdState(null);
    setCrawlStatus(null);
    setPagesCrawled(0);
    setMaxPages(0);
    setObservations([]);
    setErrorMessage(null);
  }, []);

  const value = useMemo<AnalysisContextValue>(
    () => ({
      domain,
      phase,
      crawlRunId,
      crawlStatus,
      pagesCrawled,
      maxPages,
      observations,
      errorMessage,
      startAnalysis,
      setCrawlRunId,
      updateCrawlProgress,
      completeAnalysis,
      failAnalysis,
      resetAnalysis,
    }),
    [
      domain,
      phase,
      crawlRunId,
      crawlStatus,
      pagesCrawled,
      maxPages,
      observations,
      errorMessage,
      startAnalysis,
      setCrawlRunId,
      updateCrawlProgress,
      completeAnalysis,
      failAnalysis,
      resetAnalysis,
    ],
  );

  return (
    <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);

  if (!context) {
    throw new Error("useAnalysis must be used within AnalysisProvider");
  }

  return context;
}
