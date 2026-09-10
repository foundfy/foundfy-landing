import {
  formatFindingEvidence,
  formatFindingPath,
  formatPriorityLabel,
} from "@/lib/analysis/finding-display";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import styles from "./WebsiteAnalysisEntry.module.css";

type FindingCardProps = {
  finding: AnalysisFinding;
  variant?: "highlight" | "default";
};

export default function FindingCard({
  finding,
  variant = "default",
}: FindingCardProps) {
  const evidence = formatFindingEvidence(finding);
  const pagePath = formatFindingPath(finding.pageUrl);
  const isHighlight = variant === "highlight";

  return (
    <article
      className={`${styles.findingCard} ${
        isHighlight ? styles.findingCardHighlight : ""
      }`.trim()}
    >
      <div className={styles.findingCardHeader}>
        <h3 className={styles.findingTitle}>{finding.title}</h3>
        {finding.priority ? (
          <span
            className={`${styles.priorityBadge} ${
              styles[`priority_${finding.priority.level}`]
            }`}
          >
            {formatPriorityLabel(finding.priority.level)}
          </span>
        ) : null}
      </div>

      {pagePath ? (
        <p className={styles.findingPath}>{pagePath}</p>
      ) : null}

      {isHighlight && finding.priority ? (
        <div className={styles.findingHighlightBody}>
          <p className={styles.findingWhyItMatters}>
            {finding.priority.whyItMatters}
          </p>
          <p className={styles.findingRecommendedAction}>
            {finding.priority.recommendedAction}
          </p>
        </div>
      ) : (
        <>
          <p className={styles.findingDescription}>{finding.description}</p>
          {evidence ? (
            <div className={styles.findingEvidence}>
              <span className={styles.findingEvidenceLabel}>Evidence</span>
              <p className={styles.findingEvidenceText}>{evidence}</p>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
