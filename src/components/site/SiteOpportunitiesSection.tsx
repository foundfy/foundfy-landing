"use client";

import { useCallback, useEffect, useState } from "react";
import {
  OPPORTUNITY_CARD_COPY,
  OPPORTUNITY_EMPTY_COPY,
  OPPORTUNITY_ERROR_COPY,
  OPPORTUNITY_LEADING_PAGE_COPY,
  OPPORTUNITY_LEADING_PAGE_LABEL,
  OPPORTUNITY_NO_ELIGIBLE_COPY,
  OPPORTUNITY_REVIEW_LABEL,
  OPPORTUNITY_SECTION_COPY,
  OPPORTUNITY_SECTION_HEADING,
  OPPORTUNITY_TRUNCATED_COPY,
  OPPORTUNITY_UNMAPPED_COPY,
  OPPORTUNITY_VARIANTS_HEADING,
  opportunityAppearancesCopy,
  opportunityMetricsCopy,
  opportunityPagePath,
} from "@/lib/opportunities/display";
import type { QueryOpportunitiesView, QueryOpportunityCard } from "@/lib/opportunities/types";
import { OBSERVE_EVIDENCE_LAG_COPY } from "@/lib/gsc/display";
import { formatEvidenceDate } from "@/lib/gsc/window";
import styles from "./SitePageView.module.css";

type SiteOpportunitiesSectionProps = {
  websiteId: string;
  refreshKey?: number;
};

function emptyCopy(view: QueryOpportunitiesView): string {
  if (view.emptyReason === "no_eligible") {
    return OPPORTUNITY_NO_ELIGIBLE_COPY;
  }

  return OPPORTUNITY_EMPTY_COPY;
}

function OpportunityReview({
  card,
  windowDays,
}: {
  card: QueryOpportunityCard;
  windowDays: number;
}) {
  return (
    <details className={styles.evidenceDetails}>
      <summary className={styles.evidenceSummary}>{OPPORTUNITY_REVIEW_LABEL}</summary>
      <div className={styles.decisionWhyBody}>
        <p className={styles.understandingCopy}>{opportunityAppearancesCopy(card, windowDays)}</p>
        <p className={styles.understandingCopy}>{OPPORTUNITY_LEADING_PAGE_COPY}</p>
        {!card.mapped ? <p className={styles.sectionMeta}>{OPPORTUNITY_UNMAPPED_COPY}</p> : null}
        {card.variants.length > 1 ? (
          <div className={styles.decisionWhyBlock}>
            <p className={styles.decisionWhyLabel}>{OPPORTUNITY_VARIANTS_HEADING}</p>
            <ul className={styles.opportunityVariantList}>
              {card.variants.map((variant) => (
                <li key={variant}>{variant}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className={styles.sectionMeta}>{OBSERVE_EVIDENCE_LAG_COPY}</p>
      </div>
    </details>
  );
}

export default function SiteOpportunitiesSection({
  websiteId,
  refreshKey = 0,
}: SiteOpportunitiesSectionProps) {
  const [view, setView] = useState<QueryOpportunitiesView | null>(null);
  const [visible, setVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/websites/${websiteId}/opportunities`, {
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        setVisible(false);
        setView(null);
        return;
      }

      const payload = (await response.json()) as QueryOpportunitiesView & { error?: string };
      if (!response.ok) {
        setVisible(true);
        setErrorMessage(payload.error ?? OPPORTUNITY_ERROR_COPY);
        return;
      }

      setVisible(true);
      setView(payload);
      setErrorMessage(null);
    } catch {
      setVisible(false);
    }
  }, [websiteId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!visible) {
    return null;
  }

  if (!view) {
    if (!errorMessage) {
      return null;
    }

    return (
      <section className={styles.section} aria-labelledby="site-opportunities">
        <h2 id="site-opportunities" className={styles.sectionHeading}>
          {OPPORTUNITY_SECTION_HEADING}
        </h2>
        <p className={styles.interpretationError} role="alert">
          {errorMessage}
        </p>
      </section>
    );
  }

  const periodDates = `${formatEvidenceDate(view.periodStart)} – ${formatEvidenceDate(view.periodEnd)}`;
  const truncated = view.truncated.queries || view.truncated.queryPages;

  return (
    <section className={styles.section} aria-labelledby="site-opportunities">
      <div className={styles.sectionIntro}>
        <h2 id="site-opportunities" className={styles.sectionHeading}>
          {OPPORTUNITY_SECTION_HEADING}
        </h2>
        <p className={styles.sectionMeta}>{OPPORTUNITY_SECTION_COPY}</p>
        <p className={styles.sectionMeta}>{periodDates}</p>
      </div>

      {view.opportunities.length > 0 ? (
        <ol className={styles.opportunityList}>
          {view.opportunities.map((card) => (
            <li key={card.id} className={styles.opportunityItem}>
              <p className={styles.opportunityQuery}>{card.query}</p>
              <p className={styles.opportunityMetrics}>{opportunityMetricsCopy(card)}</p>
              <p className={styles.decisionWhyLabel}>{OPPORTUNITY_LEADING_PAGE_LABEL}</p>
              <p className={styles.opportunityPage}>{opportunityPagePath(card.leadingPageUrl)}</p>
              <p className={styles.understandingCopy}>{OPPORTUNITY_CARD_COPY}</p>
              <OpportunityReview card={card} windowDays={view.windowDays} />
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.understandingCopy}>{emptyCopy(view)}</p>
      )}

      {truncated ? <p className={styles.sectionMeta}>{OPPORTUNITY_TRUNCATED_COPY}</p> : null}
    </section>
  );
}
