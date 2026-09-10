"use client";

import {
  formatEmptyHighlightsCopy,
  formatFindingsCount,
  formatZeroFindingsCopy,
} from "@/lib/analysis/finding-display";
import { formatComparisonSummary } from "@/lib/analysis/comparison-display";
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
  onReset: () => void;
};

export default function AnalysisResultsView({
  hostname,
  findings,
  findingsSummary,
  comparison,
  onReset,
}: AnalysisResultsViewProps) {
  const highlightGroupByRepresentativeId = new Map(
    findingsSummary.highlightGroups.map((group) => [
      group.representativeFindingId,
      group,
    ]),
  );

  const highlightedFindings = findingsSummary.highlightedFindingIds
    .map((findingId) => {
      const finding = findings.find((item) => item.id === findingId);
      if (!finding) {
        return undefined;
      }

      const group = highlightGroupByRepresentativeId.get(findingId);
      if (!group || group.affectedPageCount <= 1) {
        return finding;
      }

      return {
        ...finding,
        highlightAggregation: {
          affectedPageCount: group.affectedPageCount,
        },
      };
    })
    .filter((finding): finding is AnalysisFinding => finding !== undefined);

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
          <p className={styles.resultsSummary}>
            {formatFindingsCount(findingsSummary.totalCount)}
          </p>
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

              {highlightedFindings.length > 0 ? (
                <div className={styles.findingsHighlightList}>
                  {highlightedFindings.map((finding) => (
                    <FindingCard
                      key={`highlight-${finding.id}`}
                      finding={finding}
                      variant="highlight"
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
                  {findingsSummary.totalCount}
                </span>
              </div>

              <div className={styles.findingsList}>
                {findings.map((finding) => (
                  <FindingCard key={finding.id} finding={finding} variant="default" />
                ))}
              </div>
            </section>
          </>
        )}

        <div className={styles.resultsActions}>
          <button type="button" className={styles.resetButton} onClick={onReset}>
            Try another website
          </button>
          <span className={styles.resultsFutureLink} aria-disabled="true">
            View full analysis →
          </span>
        </div>
      </div>
    </div>
  );
}
