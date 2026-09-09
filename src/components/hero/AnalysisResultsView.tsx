"use client";

import { formatObservationCount } from "@/lib/analysis/observation-display";
import type { AnalysisObservation } from "@/lib/analysis/crawl-status";
import ObservationCard from "./ObservationCard";
import styles from "./WebsiteAnalysisEntry.module.css";

type AnalysisResultsViewProps = {
  hostname: string;
  observations: AnalysisObservation[];
  onReset: () => void;
};

export default function AnalysisResultsView({
  hostname,
  observations,
  onReset,
}: AnalysisResultsViewProps) {
  return (
    <div className={`${styles.analyzingGroup} ${styles.resultsGroup}`} aria-live="polite">
      <div className={`${styles.resultsCard} ${styles.resultsCardVisible}`}>
        <div className={styles.resultsHeader}>
          <div className={styles.resultsHeadingRow}>
            <span className={styles.completedDot} aria-hidden="true" />
            <h2 className={styles.resultsTitle}>Analysis complete.</h2>
          </div>
          <p className={styles.resultsSummary}>
            {formatObservationCount(observations.length)}
          </p>
          <p className={styles.resultsDomain}>
            Examined{" "}
            <span className={styles.analyzingDomain}>{hostname}</span>
          </p>
        </div>

        {observations.length > 0 ? (
          <div className={styles.observationList}>
            {observations.map((observation) => (
              <ObservationCard key={observation.id} observation={observation} />
            ))}
          </div>
        ) : (
          <p className={styles.resultsEmpty}>
            No notable observations were found in this crawl.
          </p>
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
