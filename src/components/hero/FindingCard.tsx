"use client";

import { useState } from "react";
import { formatChangeStatusLabel } from "@/lib/analysis/comparison-display";
import {
  formatFindingPath,
  formatPriorityLabel,
} from "@/lib/analysis/finding-display";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import styles from "./WebsiteAnalysisEntry.module.css";

type FindingCardProps = {
  finding: AnalysisFinding;
  variant?: "highlight" | "default";
  title?: string;
  affectedUrls?: string[];
};

export default function FindingCard({
  finding,
  variant = "default",
  title,
  affectedUrls = [],
}: FindingCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const [showUrls, setShowUrls] = useState(affectedUrls.length <= 3);
  const pagePath = formatFindingPath(finding.pageUrl);
  const isHighlight = variant === "highlight";
  const hasExplanation = !!finding.explanationEnrichment;
  const recommendation = finding.recommendation ?? null;
  const changeStatusLabel = finding.changeStatus
    ? formatChangeStatusLabel(finding.changeStatus)
    : null;
  const displayTitle = title ?? finding.title;
  const affectedPageCount = finding.highlightAggregation?.affectedPageCount ?? 0;
  const uniqueUrls = affectedUrls.length > 0 ? affectedUrls : [];
  const showSinglePath = uniqueUrls.length === 0 && pagePath;

  return (
    <article
      className={`${styles.findingCard} ${
        isHighlight ? styles.findingCardHighlight : ""
      }`.trim()}
    >
      <div className={styles.findingCardHeader}>
        <div className={styles.findingProblemBlock}>
          <span className={styles.findingActionLabel}>Problem</span>
          <h3 className={styles.findingTitle}>{displayTitle}</h3>
        </div>
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

      {showSinglePath ? <p className={styles.findingPath}>{pagePath}</p> : null}

      {uniqueUrls.length > 0 ? (
        <div className={styles.findingAffectedUrls}>
          {affectedPageCount > 1 ? (
            <p className={styles.findingAffectedCount}>
              {affectedPageCount} pages affected
            </p>
          ) : null}
          {uniqueUrls.length > 3 ? (
            <button
              type="button"
              className={styles.findingAffectedToggle}
              aria-expanded={showUrls}
              onClick={() => setShowUrls((current) => !current)}
            >
              {showUrls ? "Hide affected pages" : "Show affected pages"}
            </button>
          ) : null}
          {showUrls || uniqueUrls.length <= 3 ? (
            <ul className={styles.findingAffectedList}>
              {uniqueUrls.map((url) => (
                <li key={url} className={styles.findingPath}>
                  {formatFindingPath(url) ?? url}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : affectedPageCount > 1 ? (
        <p className={styles.findingAffectedCount}>
          Found on {affectedPageCount} pages
        </p>
      ) : null}

      {changeStatusLabel ? (
        <p
          className={`${styles.findingChangeStatus} ${
            finding.changeStatus === "new"
              ? styles.findingChangeStatusNew
              : styles.findingChangeStatusStillPresent
          }`.trim()}
        >
          {changeStatusLabel}
        </p>
      ) : null}

      {recommendation ? (
        <div className={styles.findingRecommendationBlock}>
          <div className={styles.findingActionRow}>
            <span className={styles.findingActionLabel}>Why it matters</span>
            <p className={styles.findingWhyItMatters}>{recommendation.whyItMatters}</p>
          </div>

          <div className={styles.findingActionRow}>
            <span className={styles.findingActionLabel}>What to change</span>
            <p className={styles.findingRecommendedAction}>
              {recommendation.recommendedAction}
            </p>
          </div>

          {recommendation.verification ? (
            <div className={`${styles.findingActionRow} ${styles.findingVerifyRow}`}>
              <span className={styles.findingVerifyLabel}>How to verify</span>
              <p className={styles.findingVerification}>{recommendation.verification}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className={styles.findingDescription}>{finding.description}</p>
      )}

      {hasExplanation ? (
        <div className={styles.findingExplanationSection}>
          <button
            type="button"
            className={styles.findingExplanationToggle}
            aria-expanded={showExplanation}
            onClick={() => setShowExplanation((current) => !current)}
          >
            {showExplanation ? "Hide clearer explanation" : "Explain further"}
          </button>
          {showExplanation ? (
            <div className={styles.findingExplanationBody}>
              <p className={styles.findingExplanationText}>
                {finding.explanationEnrichment?.contextualExplanation}
              </p>
              <p className={styles.findingExplanationTextMuted}>
                {finding.explanationEnrichment?.evidenceExplanation}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
