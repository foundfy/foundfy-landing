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
  AnalysisFinding,
  CrawlLifecycleStatus,
  CrawlStatusPayload,
  FindingsSummary,
} from "@/lib/analysis/crawl-status";

export type AnalysisPhase = "idle" | "starting" | "completed" | "failed";

type CompleteAnalysisInput = {
  findings: AnalysisFinding[];
  findingsSummary: FindingsSummary;
};

type AnalysisContextValue = {
  domain: NormalizedDomain | null;
  phase: AnalysisPhase;
  crawlRunId: string | null;
  crawlStatus: CrawlLifecycleStatus | null;
  pagesCrawled: number;
  maxPages: number;
  findings: AnalysisFinding[];
  findingsSummary: FindingsSummary | null;
  errorMessage: string | null;
  startAnalysis: (domain: NormalizedDomain) => void;
  setCrawlRunId: (crawlRunId: string) => void;
  updateCrawlProgress: (input: {
    status: CrawlLifecycleStatus;
    pagesCrawled?: number;
    maxPages?: number;
    findings?: AnalysisFinding[];
    findingsSummary?: FindingsSummary;
    explanationEnrichmentStatus?: CrawlStatusPayload["explanationEnrichmentStatus"];
  }) => void;
  completeAnalysis: (input: CompleteAnalysisInput) => void;
  failAnalysis: (message: string) => void;
  resetAnalysis: () => void;
};

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

const EMPTY_FINDINGS_SUMMARY: FindingsSummary = {
  totalCount: 0,
  highlightedFindingIds: [],
  highlightGroups: [],
};

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [domain, setDomain] = useState<NormalizedDomain | null>(null);
  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [crawlRunId, setCrawlRunIdState] = useState<string | null>(null);
  const [crawlStatus, setCrawlStatus] = useState<CrawlLifecycleStatus | null>(
    null,
  );
  const [pagesCrawled, setPagesCrawled] = useState(0);
  const [maxPages, setMaxPages] = useState(0);
  const [findings, setFindings] = useState<AnalysisFinding[]>([]);
  const [findingsSummary, setFindingsSummary] =
    useState<FindingsSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startAnalysis = useCallback((nextDomain: NormalizedDomain) => {
    setDomain(nextDomain);
    setPhase("starting");
    setCrawlRunIdState(null);
    setCrawlStatus("queued");
    setPagesCrawled(0);
    setMaxPages(0);
    setFindings([]);
    setFindingsSummary(null);
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
      findings?: AnalysisFinding[];
      findingsSummary?: FindingsSummary;
    }) => {
      setCrawlStatus(input.status);

      if (typeof input.pagesCrawled === "number") {
        setPagesCrawled(input.pagesCrawled);
      }

      if (typeof input.maxPages === "number") {
        setMaxPages(input.maxPages);
      }

      if (input.findings) {
        setFindings(input.findings);
      }

      if (input.findingsSummary) {
        setFindingsSummary(input.findingsSummary);
      }
    },
    [],
  );

  const completeAnalysis = useCallback((input: CompleteAnalysisInput) => {
    setPhase("completed");
    setCrawlStatus("completed");
    setFindings(input.findings);
    setFindingsSummary(input.findingsSummary);
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
    setFindings([]);
    setFindingsSummary(null);
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
      findings,
      findingsSummary,
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
      findings,
      findingsSummary,
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

export { EMPTY_FINDINGS_SUMMARY };
