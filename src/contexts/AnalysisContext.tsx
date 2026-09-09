"use client";

import {
  createContext,
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

  const value = useMemo<AnalysisContextValue>(
    () => ({
      domain,
      phase,
      crawlRunId,
      errorMessage,
      startAnalysis: (nextDomain) => {
        setDomain(nextDomain);
        setPhase("starting");
        setCrawlRunIdState(null);
        setErrorMessage(null);
      },
      setCrawlRunId: (nextCrawlRunId) => {
        setCrawlRunIdState(nextCrawlRunId);
      },
      completeAnalysis: () => {
        setPhase("completed");
        setErrorMessage(null);
      },
      failAnalysis: (message) => {
        setPhase("failed");
        setErrorMessage(message);
      },
      resetAnalysis: () => {
        setDomain(null);
        setPhase("idle");
        setCrawlRunIdState(null);
        setErrorMessage(null);
      },
    }),
    [domain, phase, crawlRunId, errorMessage],
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
