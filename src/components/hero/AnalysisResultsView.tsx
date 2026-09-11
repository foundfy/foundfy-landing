"use client";

import { useState } from "react";
import Link from "next/link";
import {
  formatEmptyHighlightsCopy,
  formatZeroFindingsCopy,
} from "@/lib/analysis/finding-display";
import { formatComparisonSummary } from "@/lib/analysis/comparison-display";
import {
  buildFullAnalysisHref,
  getLandingScanPageLinkLabel,
  shouldShowLandingFullAnalysisLink,
} from "@/lib/analysis/landing-persistent-bridge";
import { buildResultsDisplayModel } from "@/lib/analysis/results-display-model";
import type {
  AnalysisFinding,
  CrawlComparison,
  FindingsSummary,
} from "@/lib/analysis/crawl-status";
import FindingCard from "./FindingCard";
import FixedFindingsSection from "./FixedFindingsSection";
import styles from "./WebsiteAnalysisEntry.module.css";

type AnalysisResultsViewProps = {
  hostname: string;
  findings: AnalysisFinding[];
  findingsSummary: FindingsSummary;
  comparison?: CrawlComparison | null;
  crawlRunId?: string | null;
  onReset: () => void;
  resetLabel?: string;
};

export default function AnalysisResultsView({
  hostname,
  findings,
  findingsSummary,
  comparison,
  crawlRunId = null,
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
            Examined{" "}
            <span className={styles.analyzingDomain}>{hostname}</span>
          </p>
          {comparison ? (
            <p className={styles.comparisonSummary}>
              Since last scan: {formatComparisonSummary(comparison)}
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
                      affectedUrls={card.affectedUrls}
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

            <section className={styles.findingsSection} aria-labelledby="all-findings">
              <div className={styles.findingsSectionHeader}>
                <h3 id="all-findings" className={styles.findingsSectionTitle}>
                  All findings
                </h3>
                <span className={styles.findingsSectionCount}>
                  {model.actionGroupCount}
                </span>
              </div>

              {model.collapseAllFindings ? (
                <button
                  type="button"
                  className={styles.allFindingsToggle}
                  aria-expanded={allFindingsOpen}
                  aria-controls="all-findings-list"
                  onClick={() => setAllFindingsOpen((current) => !current)}
                >
                  {allFindingsOpen
                    ? "Hide all findings"
                    : `Show all findings (${model.actionGroupCount})`}
                </button>
              ) : null}

              {allFindingsOpen ? (
                <div id="all-findings-list" className={styles.findingsList}>
                  {model.allFindingCards.map((card) => (
                    <FindingCard
                      key={card.key}
                      finding={card.finding}
                      variant="default"
                      title={card.title}
                      affectedUrls={card.affectedUrls}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          </>
        )}

        <div className={styles.resultsActions}>
          <button type="button" className={styles.resetButton} onClick={onReset}>
            {resetLabel}
          </button>
          {showFullAnalysisLink && crawlRunId ? (
            <Link
              href={buildFullAnalysisHref(crawlRunId)}
              className={styles.resultsFullAnalysisLink}
            >
              {getLandingScanPageLinkLabel()}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
