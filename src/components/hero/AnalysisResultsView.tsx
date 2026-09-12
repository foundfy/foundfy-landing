"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCompletedScopeCopy } from "@/lib/analysis/analysis-scope";
import {
  formatEmptyHighlightsCopy,
  formatJobCount,
  formatZeroFindingsCopy,
} from "@/lib/analysis/finding-display";
import { formatComparisonSummary } from "@/lib/analysis/comparison-display";
import {
  buildFullAnalysisHref,
  getLandingScanPageLinkLabel,
  getScanAgainLabel,
  shouldShowLandingFullAnalysisLink,
  shouldShowScanAgain,
  type ResultsCtaSurface,
} from "@/lib/analysis/landing-persistent-bridge";
import { buildResultsDisplayModel } from "@/lib/analysis/results-display-model";
import type {
  AnalysisFinding,
  CrawlComparison,
  FindingsSummary,
} from "@/lib/analysis/crawl-status";
import { useRescanNavigation } from "@/hooks/useRescanNavigation";
import FindingCard from "./FindingCard";
import FixedFindingsSection from "./FixedFindingsSection";
import styles from "./WebsiteAnalysisEntry.module.css";

type AnalysisResultsViewProps = {
  hostname: string;
  findings: AnalysisFinding[];
  findingsSummary: FindingsSummary;
  comparison?: CrawlComparison | null;
  crawlRunId?: string | null;
  websiteId?: string | null;
  pagesCrawled?: number;
  surface?: ResultsCtaSurface;
  onReset: () => void;
  resetLabel?: string;
};

export default function AnalysisResultsView({
  hostname,
  findings,
  findingsSummary,
  comparison,
  crawlRunId = null,
  websiteId = null,
  pagesCrawled = 0,
  surface = "landing",
  onReset,
  resetLabel = "Try another website",
}: AnalysisResultsViewProps) {
  const showFullAnalysisLink = shouldShowLandingFullAnalysisLink({
    phase: "completed",
    crawlRunId,
  });
  const model = buildResultsDisplayModel(findings, findingsSummary);
  const [allFindingsOpen, setAllFindingsOpen] = useState(
    !model.collapseAllFindings,
  );
  const zeroFindingsCopy = formatZeroFindingsCopy();
  const emptyHighlightsCopy = formatEmptyHighlightsCopy();
  const showScanAgain = shouldShowScanAgain({ surface, websiteId });
  const { scanAgain, isRescanning, rescanError } = useRescanNavigation(websiteId);

  return (
    <div className={`${styles.analyzingGroup} ${styles.resultsGroup}`} aria-live="polite">
      <div className={`${styles.resultsCard} ${styles.resultsCardVisible}`}>
        <div className={styles.resultsHeader}>
          <div className={styles.resultsHeadingRow}>
            <span className={styles.completedDot} aria-hidden="true" />
            <h2 className={styles.resultsTitle}>Analysis complete.</h2>
          </div>
          <p className={styles.resultsSummary}>{model.brief}</p>
          {model.seriousness ? (
            <p className={styles.resultsSeriousness}>{model.seriousness}</p>
          ) : null}
          <p className={styles.resultsDomain}>
            <span className={styles.analyzingDomain}>{hostname}</span>
          </p>
          <p className={styles.resultsScope}>{formatCompletedScopeCopy(pagesCrawled)}</p>
          {comparison ? (
            <p className={styles.comparisonSummary}>
              Since last scan:{" "}
              {formatComparisonSummary(comparison, model.actionGroupCount)}
            </p>
          ) : null}
        </div>

        {comparison ? (
          <FixedFindingsSection fixedFindings={comparison.fixedFindings} />
        ) : null}

        {findings.length === 0 ? (
          <div className={styles.resultsEmptyBlock}>
            <p className={styles.resultsEmptyTitle}>{zeroFindingsCopy.title}</p>
            <p className={styles.resultsEmpty}>{zeroFindingsCopy.description}</p>
          </div>
        ) : (
          <>
            <section className={styles.findingsSection} aria-labelledby="what-matters-first">
              <div className={styles.findingsSectionHeader}>
                <h3 id="what-matters-first" className={styles.findingsSectionTitle}>
                  What matters first
                </h3>
              </div>

              {model.highlightCards.length > 0 ? (
                <div className={styles.findingsHighlightList}>
                  {model.highlightCards.map((card) => (
                    <FindingCard
                      key={`highlight-${card.key}`}
                      finding={card.finding}
                      variant="highlight"
                      title={card.title}
                      sharedTitleLine={card.sharedTitleLine}
                      affectedUrls={card.affectedUrls}
                      affectedPages={card.affectedPages}
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.findingsHighlightEmpty}>
                  <p className={styles.findingsHighlightEmptyTitle}>
                    {emptyHighlightsCopy.title}
                  </p>
                  <p className={styles.findingsHighlightEmptyText}>
                    {emptyHighlightsCopy.description}
                  </p>
                </div>
              )}
            </section>

            <section className={styles.findingsSection} aria-labelledby="all-jobs">
              <div className={styles.findingsSectionHeader}>
                <h3 id="all-jobs" className={styles.findingsSectionTitle}>
                  All jobs
                </h3>
                <span className={styles.findingsSectionCount}>
                  {formatJobCount(model.actionGroupCount)}
                </span>
              </div>

              {model.collapseAllFindings ? (
                <button
                  type="button"
                  className={styles.allFindingsToggle}
                  aria-expanded={allFindingsOpen}
                  aria-controls="all-jobs-list"
                  onClick={() => setAllFindingsOpen((current) => !current)}
                >
                  {allFindingsOpen
                    ? "Hide all jobs"
                    : `Show all jobs (${model.actionGroupCount})`}
                </button>
              ) : null}

              {allFindingsOpen ? (
                <div id="all-jobs-list" className={styles.findingsList}>
                  {model.allFindingCards.map((card) => (
                    <FindingCard
                      key={card.key}
                      finding={card.finding}
                      variant="default"
                      title={card.title}
                      sharedTitleLine={card.sharedTitleLine}
                      affectedUrls={card.affectedUrls}
                      affectedPages={card.affectedPages}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          </>
        )}

        {showScanAgain ? (
          <div className={styles.scanAgainContextual}>
            <button
              type="button"
              className={styles.scanAgainButton}
              onClick={() => void scanAgain()}
              disabled={isRescanning}
            >
              {isRescanning ? "Starting scan…" : getScanAgainLabel()}
            </button>
            {rescanError ? (
              <p className={styles.rescanError} role="alert">
                {rescanError}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className={styles.resultsActions}>
          {showFullAnalysisLink && crawlRunId ? (
            <Link
              href={buildFullAnalysisHref(crawlRunId)}
              className={styles.resultsFullAnalysisLink}
            >
              {getLandingScanPageLinkLabel()}
            </Link>
          ) : null}
          <button type="button" className={styles.resetButton} onClick={onReset}>
            {resetLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
