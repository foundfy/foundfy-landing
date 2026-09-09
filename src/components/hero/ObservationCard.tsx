import {
  formatObservationEvidence,
  formatSeverityLabel,
} from "@/lib/analysis/observation-display";
import type { AnalysisObservation } from "@/lib/analysis/crawl-status";
import styles from "./WebsiteAnalysisEntry.module.css";

type ObservationCardProps = {
  observation: AnalysisObservation;
};

export default function ObservationCard({ observation }: ObservationCardProps) {
  const evidence = formatObservationEvidence(observation);

  return (
    <article className={styles.observationCard}>
      <div className={styles.observationCardHeader}>
        <h3 className={styles.observationTitle}>{observation.title}</h3>
        <span
          className={`${styles.observationSeverity} ${styles[`severity_${observation.severity}`]}`}
        >
          {formatSeverityLabel(observation.severity)}
        </span>
      </div>
      <p className={styles.observationDescription}>{observation.description}</p>
      {evidence ? (
        <div className={styles.observationEvidence}>
          <span className={styles.observationEvidenceLabel}>Evidence</span>
          <p className={styles.observationEvidenceText}>{evidence}</p>
        </div>
      ) : null}
    </article>
  );
}
