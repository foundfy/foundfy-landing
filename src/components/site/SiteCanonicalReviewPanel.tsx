"use client";

import { useState } from "react";
import {
  CANONICAL_REVIEW_CANONICAL_HEADING,
  CANONICAL_REVIEW_DECIDE_COPY,
  CANONICAL_REVIEW_DECIDE_HEADING,
  CANONICAL_REVIEW_ERROR_COPY,
  CANONICAL_REVIEW_LABEL,
  CANONICAL_REVIEW_OUTCOME_LABELS,
  CANONICAL_REVIEW_PAGE_HEADING,
  CANONICAL_REVIEW_STALE_COPY,
  CANONICAL_REVIEW_WHY_COPY,
  CANONICAL_REVIEW_WHY_HEADING,
  canonicalReviewStatusLabel,
} from "@/lib/actions/review-display";
import type { CanonicalReviewOutcome, CanonicalReviewView } from "@/lib/actions/review-types";
import styles from "./SitePageView.module.css";

type ReviewIdentity = {
  pageUrl: string;
  canonicalUrl: string;
};

type SiteCanonicalReviewPanelProps = {
  websiteId: string;
  decisionId: string | null;
  identity: ReviewIdentity;
  review: CanonicalReviewView | null;
  interactive: boolean;
  onReviewChange?: (review: CanonicalReviewView) => void;
};

export default function SiteCanonicalReviewPanel({
  websiteId,
  decisionId,
  identity,
  review,
  interactive,
  onReviewChange,
}: SiteCanonicalReviewPanelProps) {
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submit(outcome: CanonicalReviewOutcome) {
    if (!interactive || !decisionId) {
      return;
    }

    setIsWorking(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/websites/${websiteId}/reviews`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId, outcome }),
      });
      const payload = (await response.json().catch(() => ({}))) as CanonicalReviewView & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? CANONICAL_REVIEW_ERROR_COPY);
      }
      onReviewChange?.(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : CANONICAL_REVIEW_ERROR_COPY);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className={styles.actionPanel}>
      {review ? (
        <p className={styles.sectionMeta}>
          {canonicalReviewStatusLabel(review.outcome, review.currency)}
        </p>
      ) : null}

      {review?.currency === "stale" ? (
        <p className={styles.sectionMeta}>{CANONICAL_REVIEW_STALE_COPY}</p>
      ) : null}

      <div className={styles.decisionWhyBlock}>
        <p className={styles.decisionWhyLabel}>{CANONICAL_REVIEW_PAGE_HEADING}</p>
        <p className={styles.understandingCopy}>{identity.pageUrl}</p>
      </div>

      <div className={styles.decisionWhyBlock}>
        <p className={styles.decisionWhyLabel}>{CANONICAL_REVIEW_CANONICAL_HEADING}</p>
        <p className={styles.understandingCopy}>{identity.canonicalUrl}</p>
      </div>

      <div className={styles.decisionWhyBlock}>
        <p className={styles.decisionWhyLabel}>{CANONICAL_REVIEW_WHY_HEADING}</p>
        <p className={styles.understandingCopy}>{CANONICAL_REVIEW_WHY_COPY}</p>
      </div>

      {interactive ? (
        <>
          <div className={styles.decisionWhyBlock}>
            <p className={styles.decisionWhyLabel}>{CANONICAL_REVIEW_DECIDE_HEADING}</p>
            <p className={styles.understandingCopy}>{CANONICAL_REVIEW_DECIDE_COPY}</p>
          </div>

          <div className={styles.interpretationActions} aria-label={CANONICAL_REVIEW_LABEL}>
            {(Object.keys(CANONICAL_REVIEW_OUTCOME_LABELS) as CanonicalReviewOutcome[]).map(
              (outcome) => (
                <button
                  key={outcome}
                  type="button"
                  className={styles.reviewChoice}
                  disabled={isWorking}
                  onClick={() => void submit(outcome)}
                >
                  {isWorking ? "Saving…" : CANONICAL_REVIEW_OUTCOME_LABELS[outcome]}
                </button>
              ),
            )}
          </div>
        </>
      ) : null}

      {errorMessage ? (
        <p className={styles.interpretationError} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
