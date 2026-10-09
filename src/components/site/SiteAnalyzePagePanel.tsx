"use client";

import { useEffect, useState } from "react";
import {
  ANALYZE_PAGE_ANALYZED_COPY,
  ANALYZE_PAGE_ANALYZED_LABEL,
  ANALYZE_PAGE_ANALYZING_LABEL,
  ANALYZE_PAGE_BLOCKED_COPY,
  ANALYZE_PAGE_ERROR_COPY,
  ANALYZE_PAGE_FETCH_FAILED_COPY,
  ANALYZE_PAGE_LABEL,
} from "@/lib/analysis-requests/display";
import type { AnalysisRequestView } from "@/lib/analysis-requests/types";
import type { DecisionView } from "@/lib/decisions/types";
import styles from "./SitePageView.module.css";

type SiteAnalyzePagePanelProps = {
  websiteId: string;
  decision: Pick<DecisionView, "id" | "decisionType">;
  request: AnalysisRequestView | null;
  current: boolean;
  onRequestChange: (request: AnalysisRequestView) => void;
};

export default function SiteAnalyzePagePanel({
  websiteId,
  decision,
  request,
  current,
  onRequestChange,
}: SiteAnalyzePagePanelProps) {
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (
      !request?.crawlRunId ||
      (request.status !== "requested" && request.status !== "running")
    ) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        await fetch(`/api/crawl/${request.crawlRunId}`, { cache: "no-store" });
        const response = await fetch(`/api/websites/${websiteId}/analysis-requests`, {
          cache: "no-store",
        });
        if (!response.ok || cancelled) {
          return;
        }
        const payload = (await response.json()) as { requests?: AnalysisRequestView[] };
        const next = (payload.requests ?? []).find((item) => item.id === request.id);
        if (next) {
          onRequestChange(next);
        }
      } catch {
        // Keep the last known request state; the owner can retry.
      }
    };

    const interval = window.setInterval(() => {
      void poll();
    }, 3000);
    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [onRequestChange, request, websiteId]);

  async function analyze() {
    setIsWorking(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/websites/${websiteId}/analysis-requests`, {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decisionId: decision.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as AnalysisRequestView & {
        error?: string;
      };
      if (!response.ok) {
        setErrorMessage(payload.error ?? ANALYZE_PAGE_ERROR_COPY);
        return;
      }
      onRequestChange(payload);
    } catch {
      setErrorMessage(ANALYZE_PAGE_ERROR_COPY);
    } finally {
      setIsWorking(false);
    }
  }

  const status = request?.status ?? null;
  if (!request && !current) {
    return null;
  }

  const showButton = current && (status == null || status === "blocked");

  return (
    <div className={styles.actionPanel}>
      {status === "analyzed" ? (
        <div>
          <p className={styles.decisionWhyLabel}>{ANALYZE_PAGE_ANALYZED_LABEL}</p>
          <p className={styles.understandingCopy}>{ANALYZE_PAGE_ANALYZED_COPY}</p>
        </div>
      ) : null}

      {status === "fetch_failed" ? (
        <p className={styles.understandingCopy} role="status">
          {ANALYZE_PAGE_FETCH_FAILED_COPY}
        </p>
      ) : null}

      {status === "blocked" ? (
        <p className={styles.understandingCopy} role="status">
          {ANALYZE_PAGE_BLOCKED_COPY}
        </p>
      ) : null}

      {status === "requested" || status === "running" ? (
        <p className={styles.sectionMeta} role="status">
          {ANALYZE_PAGE_ANALYZING_LABEL}
        </p>
      ) : null}

      {showButton && current ? (
        <div className={styles.interpretationActions}>
          <button
            type="button"
            className={styles.scanButton}
            disabled={isWorking}
            onClick={() => void analyze()}
          >
            {isWorking ? ANALYZE_PAGE_ANALYZING_LABEL : ANALYZE_PAGE_LABEL}
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <p className={styles.interpretationError} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
