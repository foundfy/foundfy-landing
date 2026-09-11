"use client";

import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import { getCrawlStatusCopy } from "@/lib/analysis/crawl-progress";
import type {
  AnalysisFinding,
  CrawlComparison,
  CrawlLifecycleStatus,
  FindingsSummary,
} from "@/lib/analysis/crawl-status";
import { useAnalysis } from "@/contexts/AnalysisContext";
import { useCrawlProgressAnimation } from "@/hooks/useCrawlProgressAnimation";
import styles from "./WebsiteAnalysisEntry.module.css";

export type AnalysisAnalyzingViewState = {
  hostname: string;
  crawlStatus: CrawlLifecycleStatus;
  pagesCrawled: number;
  maxPages: number;
  findings: AnalysisFinding[];
  findingsSummary: FindingsSummary | null;
  comparison: CrawlComparison | null;
  onResultsReady: () => void;
};

type AnalysisAnalyzingViewInnerProps = AnalysisAnalyzingViewState & {
  onReset: () => void;
  resetLabel?: string;
};

export function AnalysisAnalyzingViewInner({
  hostname,
  crawlStatus,
  pagesCrawled,
  maxPages,
  findings,
  findingsSummary,
  comparison,
  onResultsReady,
  onReset,
  resetLabel = "Try another website",
}: AnalysisAnalyzingViewInnerProps) {
  const completionHandledRef = useRef(false);

  useEffect(() => {
    if (crawlStatus === "queued") {
      completionHandledRef.current = false;
    }
  }, [crawlStatus]);

  const handleCompletionReady = useCallback(() => {
    if (completionHandledRef.current || crawlStatus !== "completed") {
      return;
    }

    completionHandledRef.current = true;
    onResultsReady();
  }, [crawlStatus, onResultsReady]);

  const progress = useCrawlProgressAnimation({
    crawlStatus,
    pagesCrawled,
    maxPages,
    onCompletionReady: handleCompletionReady,
  });

  const statusCopy = getCrawlStatusCopy(crawlStatus);
  const isCompleting = crawlStatus === "completed";
  const clampedProgress = Math.max(0, Math.min(progress, 1));

  const pillStyle = {
    "--pill-progress": clampedProgress,
  } as CSSProperties;

  return (
    <div className={styles.analyzingGroup} aria-live="polite">
      <div
        className={`${styles.form} ${styles.formAnalyzing}`}
        style={pillStyle}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={statusCopy}
        aria-label="Analysis progress"
      >
        <span className={styles.pillLightField} aria-hidden="true">
          <span className={styles.pillLightTint} />
          <span className={styles.pillLightTrail} />
          <span className={styles.pillLightBloom} />
          <span className={styles.pillLightCore} />
          <span className={styles.pillLightSettle} />
        </span>
        <div className={styles.analyzingMain}>
          {isCompleting ? (
            <span className={styles.completedDot} aria-hidden="true" />
          ) : (
            <span className={styles.pulse} aria-hidden="true" />
          )}
          <p className={styles.analyzingTitle}>
            {isCompleting ? (
              "Analysis complete."
            ) : (
              <>
                Analyzing{" "}
                <span className={styles.analyzingDomain}>{hostname}</span>
                ...
              </>
            )}
          </p>
        </div>
      </div>
      <p className={styles.analyzingStatus}>{statusCopy}</p>
      <button type="button" className={styles.resetButton} onClick={onReset}>
        {resetLabel}
      </button>
    </div>
  );
}

type AnalysisAnalyzingViewProps = {
  onReset: () => void;
};

export default function AnalysisAnalyzingView({ onReset }: AnalysisAnalyzingViewProps) {
  const {
    domain,
    crawlStatus,
    pagesCrawled,
    maxPages,
    findings,
    findingsSummary,
    comparison,
    completeAnalysis,
  } = useAnalysis();

  return (
    <AnalysisAnalyzingViewInner
      hostname={domain?.hostname ?? ""}
      crawlStatus={crawlStatus ?? "queued"}
      pagesCrawled={pagesCrawled}
      maxPages={maxPages}
      findings={findings}
      findingsSummary={findingsSummary}
      comparison={comparison}
      onReset={onReset}
      onResultsReady={() => {
        completeAnalysis({
          findings,
          findingsSummary: findingsSummary ?? {
            totalCount: findings.length,
            highlightedFindingIds: [],
            highlightGroups: [],
          },
          comparison: comparison ?? undefined,
        });
      }}
    />
  );
}
