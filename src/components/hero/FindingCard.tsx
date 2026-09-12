"use client";

import { useState } from "react";
import { formatChangeStatusLabel } from "@/lib/analysis/comparison-display";
import {
  AFFECTED_PAGE_PREVIEW_COUNT,
  formatFindingPath,
  formatPriorityLabel,
} from "@/lib/analysis/finding-display";
import type { AffectedPageDetail } from "@/lib/analysis/results-display-model";
import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import styles from "./WebsiteAnalysisEntry.module.css";

type FindingCardProps = {
  finding: AnalysisFinding;
  variant?: "highlight" | "default";
  title?: string;
  sharedTitleLine?: string | null;
  affectedUrls?: string[];
  affectedPages?: AffectedPageDetail[];
};

export default function FindingCard({
  finding,
  variant = "default",
  title,
  sharedTitleLine: _sharedTitleLine = null,
  affectedUrls = [],
  affectedPages = [],
}: FindingCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);
  const uniqueUrls = affectedUrls.length > 0 ? affectedUrls : [];
  const details =
    affectedPages.length > 0
      ? affectedPages
      : uniqueUrls.map((url) => ({
          url,
          label: formatFindingPath(url) ?? url,
          canonicalLabel: null,
        }));
  const previewCount = AFFECTED_PAGE_PREVIEW_COUNT;
  const hasMorePages = details.length > previewCount;
  const [showAllUrls, setShowAllUrls] = useState(false);
  const pagePath = formatFindingPath(finding.pageUrl);
  const isHighlight = variant === "highlight";
  const hasExplanation = !!finding.explanationEnrichment;
  const recommendation = finding.recommendation ?? null;
  const changeStatusLabel = finding.changeStatus
    ? formatChangeStatusLabel(finding.changeStatus)
    : null;
  const displayTitle = title ?? finding.title;
  const visiblePages = showAllUrls || !hasMorePages
    ? details
    : details.slice(0, previewCount);
  const hiddenCount = details.length - visiblePages.length;
  const showSinglePath = details.length === 0 && pagePath;
  const canonicalFromEvidence =
    finding.ruleKey === "indexability.canonical_points_elsewhere" &&
    typeof finding.evidence.canonical === "string"
      ? formatFindingPath(finding.evidence.canonical)
      : null;

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

      {showSinglePath ? (
        <p className={styles.findingPath} title={finding.pageUrl ?? undefined}>
          {pagePath}
          {canonicalFromEvidence ? (
            <span className={styles.findingCanonicalTarget}>
              {" "}
              → {canonicalFromEvidence}
            </span>
          ) : null}
        </p>
      ) : null}

      {details.length > 0 ? (
        <div className={styles.findingAffectedUrls}>
          <ul className={styles.findingAffectedList}>
            {visiblePages.map((page) => (
              <li key={page.url} className={styles.findingPath} title={page.url}>
                <span>{page.label}</span>
                {page.canonicalLabel ? (
                  <span className={styles.findingCanonicalTarget}>
                    {" "}
                    → {page.canonicalLabel}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {hasMorePages ? (
            <button
              type="button"
              className={styles.findingAffectedToggle}
              aria-expanded={showAllUrls}
              onClick={() => setShowAllUrls((current) => !current)}
            >
              {showAllUrls ? "Show fewer pages" : `+ ${hiddenCount} more`}
            </button>
          ) : null}
        </div>
      ) : null}

      {recommendation ? (
        <div className={styles.findingRecommendationBlock}>
          <div className={styles.findingActionRow}>
            <span className={styles.findingActionLabel}>What to change</span>
            <p className={styles.findingRecommendedAction}>
              {recommendation.recommendedAction}
            </p>
          </div>

          <div className={`${styles.findingActionRow} ${styles.findingWhyRow}`}>
            <span className={styles.findingWhyLabel}>Why it matters</span>
            <p className={styles.findingWhyItMatters}>{recommendation.whyItMatters}</p>
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

      {hasExplanation ? (
        <div className={styles.findingExplanationSection}>
          <button
            type="button"
            className={styles.findingExplanationToggle}
            aria-expanded={showExplanation}
            onClick={() => setShowExplanation((current) => !current)}
          >
            {showExplanation ? "Hide further explanation" : "Explain further"}
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
