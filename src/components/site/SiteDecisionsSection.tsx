"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DECISION_BAND_LABELS,
  DECISION_BLOCKED_ACTION,
  DECISION_BLOCKED_COPY,
  DECISION_BOUNDED_COPY,
  DECISION_CONFIDENCE_HEADING,
  DECISION_DEMAND_HEADING,
  DECISION_EMPTY_GSC_COPY,
  DECISION_ERROR_COPY,
  DECISION_GENERATE_LABEL,
  DECISION_GOAL_HEADING,
  DECISION_NO_OVERLAP_COPY,
  DECISION_PERIOD_HEADING,
  DECISION_PERIOD_VALUE,
  DECISION_PRIORITY_HEADING,
  DECISION_READY_COPY,
  DECISION_REFRESH_LABEL,
  DECISION_SECTION_HEADING,
  DECISION_STALE_COPY,
  DECISION_WEBSITE_EVIDENCE_HEADING,
  DECISION_WHY_HEADING,
  DECISION_WHY_LABEL,
} from "@/lib/decisions/display";
import type { DecisionPrerequisiteReason, DecisionView, DecisionsOwnerView } from "@/lib/decisions/types";
import { formatEvidenceDate } from "@/lib/gsc/window";
import styles from "./SitePageView.module.css";

type SiteDecisionsSectionProps = {
  websiteId: string;
};

function demandCopy(demand: DecisionView["why"]["searchDemand"]): string | null {
  if (!demand) {
    return null;
  }

  return `${demand.appearances.toLocaleString("en-US")} appearances · ${demand.visits.toLocaleString("en-US")} visits`;
}

function DecisionWhy({ decision }: { decision: DecisionView }) {
  const demand = demandCopy(decision.why.searchDemand);
  const periodDates =
    decision.why.evidencePeriod != null
      ? `${formatEvidenceDate(decision.why.evidencePeriod.start)} – ${formatEvidenceDate(decision.why.evidencePeriod.end)}`
      : null;

  return (
    <details className={styles.evidenceDetails}>
      <summary className={styles.evidenceSummary}>{DECISION_WHY_LABEL}</summary>
      <div className={styles.decisionWhyBody}>
        <h4 className={styles.subsectionHeading}>{DECISION_WHY_HEADING}</h4>

        {demand ? (
          <div className={styles.decisionWhyBlock}>
            <p className={styles.decisionWhyLabel}>{DECISION_DEMAND_HEADING}</p>
            <p className={styles.understandingCopy}>{demand}</p>
          </div>
        ) : null}

        <div className={styles.decisionWhyBlock}>
          <p className={styles.decisionWhyLabel}>{DECISION_WEBSITE_EVIDENCE_HEADING}</p>
          <p className={styles.understandingCopy}>{decision.why.websiteEvidence}</p>
        </div>

        <div className={styles.decisionWhyBlock}>
          <p className={styles.decisionWhyLabel}>{DECISION_GOAL_HEADING}</p>
          <p className={styles.understandingCopy}>{decision.why.goalContext}</p>
        </div>

        <div className={styles.decisionWhyBlock}>
          <p className={styles.decisionWhyLabel}>{DECISION_PERIOD_HEADING}</p>
          <p className={styles.understandingCopy}>
            {DECISION_PERIOD_VALUE}
            {periodDates ? ` · ${periodDates}` : ""}
          </p>
        </div>

        <div className={styles.decisionWhyBlock}>
          <p className={styles.decisionWhyLabel}>{DECISION_CONFIDENCE_HEADING}</p>
          <p className={styles.understandingCopy}>{decision.why.matchingConfidence}</p>
        </div>

        <div className={styles.decisionWhyBlock}>
          <p className={styles.decisionWhyLabel}>{DECISION_PRIORITY_HEADING}</p>
          <p className={styles.understandingCopy}>
            {DECISION_BAND_LABELS[decision.priorityBand]}
          </p>
        </div>

        {decision.why.truncated ? (
          <p className={styles.sectionMeta}>{DECISION_BOUNDED_COPY}</p>
        ) : null}
      </div>
    </details>
  );
}

function blockedCopy(reason: DecisionPrerequisiteReason | null): string | null {
  return reason ? DECISION_BLOCKED_COPY[reason] : null;
}

function emptyStateCopy(view: DecisionsOwnerView): string | null {
  if (view.decisions.length > 0) {
    return null;
  }

  if (view.blockedReason) {
    return blockedCopy(view.blockedReason);
  }

  if (view.emptyReason === "empty_gsc_evidence") {
    return DECISION_EMPTY_GSC_COPY;
  }

  if (view.emptyReason === "no_cross_signal_candidates") {
    return DECISION_NO_OVERLAP_COPY;
  }

  return null;
}

export default function SiteDecisionsSection({ websiteId }: SiteDecisionsSectionProps) {
  const [view, setView] = useState<DecisionsOwnerView | null>(null);
  const [visible, setVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/websites/${websiteId}/decisions`, {
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        setVisible(false);
        setView(null);
        return;
      }

      const payload = (await response.json()) as DecisionsOwnerView & { error?: string };
      if (!response.ok) {
        setVisible(true);
        setActionError(payload.error ?? DECISION_ERROR_COPY);
        return;
      }

      setVisible(true);
      setView(payload);
      setActionError(null);
    } catch {
      setVisible(false);
    }
  }, [websiteId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setIsGenerating(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/websites/${websiteId}/decisions/generate`, {
        method: "POST",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as DecisionsOwnerView & {
        error?: string;
        reason?: DecisionPrerequisiteReason;
      };

      if (!response.ok) {
        setActionError(payload.error ?? DECISION_ERROR_COPY);
        if (payload.reason) {
          void load();
        }
        return;
      }

      setView(payload);
    } catch {
      setActionError(DECISION_ERROR_COPY);
    } finally {
      setIsGenerating(false);
    }
  }

  if (!visible) {
    return null;
  }

  if (!view) {
    if (!actionError) {
      return null;
    }

    return (
      <section className={styles.section} aria-labelledby="site-decisions">
        <h2 id="site-decisions" className={styles.sectionHeading}>
          {DECISION_SECTION_HEADING}
        </h2>
        <p className={styles.interpretationError} role="alert">
          {actionError}
        </p>
      </section>
    );
  }

  const copy = emptyStateCopy(view);
  const action = view.blockedReason ? DECISION_BLOCKED_ACTION[view.blockedReason] : null;
  const showGenerate = view.canGenerate && (view.run == null || view.staleReason != null);
  const generateLabel = view.staleReason ? DECISION_REFRESH_LABEL : DECISION_GENERATE_LABEL;

  return (
    <section className={styles.section} aria-labelledby="site-decisions">
      <div className={styles.sectionIntro}>
        <h2 id="site-decisions" className={styles.sectionHeading}>
          {DECISION_SECTION_HEADING}
        </h2>
        {view.status === "not_generated" && view.canGenerate ? (
          <p className={styles.sectionMeta}>{DECISION_READY_COPY}</p>
        ) : null}
        {view.staleReason && !view.blockedReason ? (
          <p className={styles.sectionMeta}>{DECISION_STALE_COPY}</p>
        ) : null}
      </div>

      {view.decisions.length > 0 ? (
        <ol className={styles.decisionList}>
          {view.decisions.map((decision) => (
            <li key={decision.id} className={styles.decisionItem}>
              <p className={styles.decisionBand}>{DECISION_BAND_LABELS[decision.priorityBand]}</p>
              <p className={styles.decisionTitle}>
                <span className={styles.decisionRank}>{decision.rank}.</span> {decision.title}
              </p>
              <p className={styles.understandingCopy}>{decision.explanation}</p>
              <DecisionWhy decision={decision} />
            </li>
          ))}
        </ol>
      ) : copy ? (
        <div className={styles.emptyStateBlock}>
          <p className={styles.emptyStateCopy}>{copy}</p>
          {action ? (
            <p className={styles.emptyStateAction}>
              <a className={styles.textLink} href={action.href}>
                {action.label}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      {showGenerate ? (
        <div className={styles.interpretationActions}>
          <button
            type="button"
            className={styles.scanButton}
            disabled={isGenerating}
            onClick={() => void generate()}
          >
            {isGenerating ? "Prioritizing…" : generateLabel}
          </button>
        </div>
      ) : null}

      {actionError ? (
        <p className={styles.interpretationError} role="alert">
          {actionError}
        </p>
      ) : null}
    </section>
  );
}
