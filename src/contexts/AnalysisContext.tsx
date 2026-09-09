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

export type AnalysisPhase = "idle" | "starting" | "completed" | "failed";

type AnalysisContextValue = {
  domain: NormalizedDomain | null;
  phase: AnalysisPhase;
  crawlRunId: string | null;
  errorMessage: string | null;
  startAnalysis: (domain: NormalizedDomain) => void;
  setCrawlRunId: (crawlRunId: string) => void;
  completeAnalysis: () => void;
  failAnalysis: (message: string) => void;
  resetAnalysis: () => void;
};

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [domain, setDomain] = useState<NormalizedDomain | null>(null);
  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [crawlRunId, setCrawlRunIdState] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startAnalysis = useCallback((nextDomain: NormalizedDomain) => {
    setDomain(nextDomain);
    setPhase("starting");
    setCrawlRunIdState(null);
    setErrorMessage(null);
  }, []);

  const setCrawlRunId = useCallback((nextCrawlRunId: string) => {
    setCrawlRunIdState(nextCrawlRunId);
  }, []);

  const completeAnalysis = useCallback(() => {
    setPhase("completed");
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
    setErrorMessage(null);
  }, []);

  const value = useMemo<AnalysisContextValue>(
    () => ({
      domain,
      phase,
      crawlRunId,
      errorMessage,
      startAnalysis,
      setCrawlRunId,
      completeAnalysis,
      failAnalysis,
      resetAnalysis,
    }),
    [
      domain,
      phase,
      crawlRunId,
      errorMessage,
      startAnalysis,
      setCrawlRunId,
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
