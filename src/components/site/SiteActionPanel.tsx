"use client";

import { useEffect, useState } from "react";
import {
  ACTION_APPROVE_LABEL,
  ACTION_APPROVED_AT_HEADING,
  ACTION_APPROVED_COPY,
  ACTION_BLOCKED_COPY,
  ACTION_CANCEL_LABEL,
  ACTION_CRAWL_HEADING,
  ACTION_CURRENT_NONE_LABEL,
  ACTION_ERROR_COPY,
  ACTION_EXECUTE_DISABLED,
  ACTION_EXECUTE_LABEL,
  ACTION_EXECUTED_COPY,
  ACTION_EXPECTED_HEADING,
  ACTION_INCONCLUSIVE_COPY,
  ACTION_LEARN_APPEARANCES_HEADING,
  ACTION_LEARN_BASELINE_PERIOD_HEADING,
  ACTION_LEARN_COMPARISON_PERIOD_HEADING,
  ACTION_LEARN_CTR_HEADING,
  ACTION_LEARN_DECLINE_CAVEAT_COPY,
  ACTION_LEARN_HEADING,
  ACTION_LEARN_IDENTITY_COPY,
  ACTION_LEARN_INSUFFICIENT_COPY,
  ACTION_LEARN_MIXED_COPY,
  ACTION_LEARN_NO_CHANGE_COPY,
  ACTION_LEARN_OTHER_FACTORS_COPY,
  ACTION_LEARN_POSITION_HEADING,
  ACTION_LEARN_REMOVED_COPY,
  ACTION_LEARN_TRUNCATED_COPY,
  ACTION_LEARN_VISITS_HEADING,
  ACTION_LEARN_WAITING_COPY,
  ACTION_MUTATION_HEADING,
  ACTION_NOT_VERIFIED_COPY,
  ACTION_OBSERVED_HEADING,
  ACTION_PAGE_HEADING,
  ACTION_PREPARE_LABEL,
  ACTION_SAFETY_HEADING,
  ACTION_SAFETY_LABELS,
  ACTION_SAVE_DRAFT_LABEL,
  ACTION_STATUS_HEADING,
  ACTION_STATUS_LABELS,
  ACTION_TITLE_GROUP_COPY,
  ACTION_TYPE_HEADING,
  ACTION_UNSAFE_STALE_COPY,
  actionCurrentLabel,
  actionFieldLabel,
  actionProposedLabel,
  actionTypeLabel,
  ACTION_VERIFICATION_STATE_HEADING,
  ACTION_VERIFIED_AT_HEADING,
  ACTION_VERIFIED_COPY,
  ACTION_VERIFY_FRESH_CRAWL_COPY,
  ACTION_VERIFY_HEADING,
  ACTION_VERIFY_LABEL,
  ACTION_WHY_HEADING,
  formatLearningRange,
  learningObservedCopy,
} from "@/lib/actions/display";
import { OBSERVE_EVIDENCE_LAG_COPY } from "@/lib/gsc/display";
import { formatEvidenceDate } from "@/lib/gsc/window";
import { ACTION_PROPOSED_VALUE_MAX_LENGTH } from "@/lib/actions/config";
import { actionSafetyState, canOfferExecute } from "@/lib/actions/history";
import { titleGroupContextFromAction } from "@/lib/actions/title-group";
import type { ActionPreviewView } from "@/lib/actions/types";
import type { DecisionView } from "@/lib/decisions/types";
import styles from "./SitePageView.module.css";

type ActionPanelDecision = Pick<DecisionView, "id" | "title" | "explanation" | "why"> & {
  supportedActionType?: DecisionView["supportedActionType"];
};

type SiteActionPanelProps = {
  websiteId: string;
  decision: ActionPanelDecision;
  action: ActionPreviewView | null;
  current: boolean;
  onActionChange: (action: ActionPreviewView | null) => void;
};

function currentValueLabel(value: string | null): string {
  return value?.trim() ? value : ACTION_CURRENT_NONE_LABEL;
}

function learningInsufficientCopy(reason: string | null): string {
  if (reason === "truncated_page_dataset") {
    return ACTION_LEARN_TRUNCATED_COPY;
  }
  if (reason === "url_identity_changed") {
    return ACTION_LEARN_IDENTITY_COPY;
  }
  if (reason === "google_evidence_removed") {
    return ACTION_LEARN_REMOVED_COPY;
  }
  return ACTION_LEARN_INSUFFICIENT_COPY;
}

export default function SiteActionPanel({
  websiteId,
  decision,
  action,
  current,
  onActionChange,
}: SiteActionPanelProps) {
  const [draft, setDraft] = useState(action?.proposedValue ?? "");
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(action?.proposedValue ?? "");
  }, [action?.id, action?.proposedValue]);

  async function request(
    path: string,
    init: RequestInit,
  ): Promise<ActionPreviewView> {
    const response = await fetch(path, { ...init, cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as ActionPreviewView & {
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error ?? ACTION_ERROR_COPY);
    }
    return payload;
  }

  async function prepare() {
    setIsWorking(true);
    setErrorMessage(null);
    try {
      const next = await request(`/api/websites/${websiteId}/actions/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: decision.id }),
      });
      setDraft(next.proposedValue ?? "");
      onActionChange(next);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : ACTION_ERROR_COPY);
    } finally {
      setIsWorking(false);
    }
  }

  async function saveDraft() {
    if (!action) {
      return;
    }

    setIsWorking(true);
    setErrorMessage(null);
    try {
      const next = await request(`/api/websites/${websiteId}/actions/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposedValue: draft }),
      });
      setDraft(next.proposedValue ?? "");
      onActionChange(next);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : ACTION_ERROR_COPY);
    } finally {
      setIsWorking(false);
    }
  }

  async function approve() {
    if (!action) {
      return;
    }

    setIsWorking(true);
    setErrorMessage(null);
    try {
      if (draft !== (action.proposedValue ?? "")) {
        await request(`/api/websites/${websiteId}/actions/${action.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposedValue: draft }),
        });
      }
      const next = await request(`/api/websites/${websiteId}/actions/${action.id}/approve`, {
        method: "POST",
      });
      setDraft(next.proposedValue ?? "");
      onActionChange(next);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : ACTION_ERROR_COPY);
    } finally {
      setIsWorking(false);
    }
  }

  async function cancel() {
    if (!action) {
      return;
    }

    setIsWorking(true);
    setErrorMessage(null);
    try {
      await request(`/api/websites/${websiteId}/actions/${action.id}/cancel`, {
        method: "POST",
      });
      setDraft("");
      onActionChange(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : ACTION_ERROR_COPY);
    } finally {
      setIsWorking(false);
    }
  }

  async function execute() {
    if (!action) {
      return;
    }

    setIsWorking(true);
    setErrorMessage(null);
    try {
      const next = await request(`/api/websites/${websiteId}/actions/${action.id}/execute`, {
        method: "POST",
      });
      setDraft(next.proposedValue ?? "");
      onActionChange(next);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : ACTION_ERROR_COPY);
    } finally {
      setIsWorking(false);
    }
  }

  async function verify() {
    if (!action) {
      return;
    }

    setIsWorking(true);
    setErrorMessage(null);
    try {
      const next = await request(`/api/websites/${websiteId}/actions/${action.id}/verify`, {
        method: "POST",
      });
      setDraft(next.proposedValue ?? "");
      onActionChange(next);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : ACTION_ERROR_COPY);
    } finally {
      setIsWorking(false);
    }
  }

  if (!action) {
    if (!current || !decision.supportedActionType) {
      return null;
    }

    return (
      <div className={styles.actionPanel}>
        <div className={styles.interpretationActions}>
          <button
            type="button"
            className={styles.scanButton}
            disabled={isWorking}
            onClick={() => void prepare()}
          >
            {isWorking ? "Preparing…" : ACTION_PREPARE_LABEL}
          </button>
        </div>
        {errorMessage ? (
          <p className={styles.interpretationError} role="alert">
            {errorMessage}
          </p>
        ) : null}
      </div>
    );
  }

  const editable = action.status === "prepared" || action.status === "awaiting_approval";
  const safety = actionSafetyState(action);
  const verification = action.verification;
  const titleGroup = titleGroupContextFromAction(action.evidenceRefs);
  const safetyCopy =
    action.status === "blocked"
      ? ACTION_BLOCKED_COPY
      : action.status === "executed"
        ? ACTION_EXECUTED_COPY
        : action.executeBlockedReason === "unsafe_stale"
          ? ACTION_UNSAFE_STALE_COPY
          : action.executeBlockedReason === "adapter_not_connected"
            ? ACTION_EXECUTE_DISABLED
            : action.executeAvailable
              ? ACTION_APPROVED_COPY
              : null;

  return (
    <div className={styles.actionPanel}>
      {safetyCopy ? <p className={styles.sectionMeta}>{safetyCopy}</p> : null}

      <div className={styles.decisionWhyBlock}>
        <p className={styles.decisionWhyLabel}>{ACTION_STATUS_HEADING}</p>
        <p className={styles.understandingCopy}>{ACTION_STATUS_LABELS[action.status]}</p>
      </div>

      <div className={styles.decisionWhyBlock}>
        <p className={styles.decisionWhyLabel}>{ACTION_TYPE_HEADING}</p>
        <p className={styles.understandingCopy}>{actionTypeLabel(action.actionType)}</p>
      </div>

      {safety ? (
        <div className={styles.decisionWhyBlock}>
          <p className={styles.decisionWhyLabel}>{ACTION_SAFETY_HEADING}</p>
          <p className={styles.understandingCopy}>{ACTION_SAFETY_LABELS[safety]}</p>
        </div>
      ) : null}

      {action.approvedAt ? (
        <div className={styles.decisionWhyBlock}>
          <p className={styles.decisionWhyLabel}>{ACTION_APPROVED_AT_HEADING}</p>
          <p className={styles.understandingCopy}>
            {new Date(action.approvedAt).toLocaleString("en-US")}
          </p>
        </div>
      ) : null}

      <div className={styles.decisionWhyBlock}>
        <p className={styles.decisionWhyLabel}>{ACTION_PAGE_HEADING}</p>
        <p className={styles.understandingCopy}>{action.targetPage.url}</p>
      </div>

      <div className={styles.decisionWhyBlock}>
        <p className={styles.decisionWhyLabel}>{actionFieldLabel(action.field)}</p>
        <p className={styles.understandingCopy}>{actionCurrentLabel(action.field)}</p>
        <p className={styles.understandingCopy}>{currentValueLabel(action.currentValue)}</p>
      </div>

      {editable ? (
        <label className={styles.interpretationLabel}>
          {actionProposedLabel(action.field)}
          <textarea
            className={styles.interpretationInput}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            maxLength={ACTION_PROPOSED_VALUE_MAX_LENGTH}
            disabled={isWorking}
          />
        </label>
      ) : (
        <div className={styles.decisionWhyBlock}>
          <p className={styles.decisionWhyLabel}>{actionProposedLabel(action.field)}</p>
          <p className={styles.understandingCopy}>
            {currentValueLabel(action.proposedValue)}
          </p>
        </div>
      )}

      <div className={styles.decisionWhyBlock}>
        <p className={styles.decisionWhyLabel}>{ACTION_WHY_HEADING}</p>
        <p className={styles.understandingCopy}>{decision.explanation}</p>
        <p className={styles.understandingCopy}>{decision.why.websiteEvidence}</p>
        <p className={styles.understandingCopy}>{decision.why.goalContext}</p>
        {titleGroup ? <p className={styles.understandingCopy}>{ACTION_TITLE_GROUP_COPY}</p> : null}
      </div>

      <div className={styles.decisionWhyBlock}>
        <p className={styles.decisionWhyLabel}>{ACTION_MUTATION_HEADING}</p>
        <pre className={styles.actionMutation}>
          {JSON.stringify(action.mutationSpec, null, 2)}
        </pre>
      </div>

      <div className={styles.decisionWhyBlock}>
        <p className={styles.decisionWhyLabel}>{ACTION_VERIFY_HEADING}</p>
        <p className={styles.understandingCopy}>{action.verificationPlan}</p>
      </div>

      {action.status === "executed" ? (
        <div className={styles.decisionWhyBlock}>
          <p className={styles.decisionWhyLabel}>{ACTION_VERIFICATION_STATE_HEADING}</p>
          {verification?.state === "fresh_crawl_required" ? (
            <p className={styles.understandingCopy}>{ACTION_VERIFY_FRESH_CRAWL_COPY}</p>
          ) : null}
          {verification?.state === "verified" ? (
            <p className={styles.understandingCopy}>{ACTION_VERIFIED_COPY}</p>
          ) : null}
          {verification?.state === "not_verified" ? (
            <p className={styles.understandingCopy}>{ACTION_NOT_VERIFIED_COPY}</p>
          ) : null}
          {verification?.state === "inconclusive" ? (
            <p className={styles.understandingCopy}>{ACTION_INCONCLUSIVE_COPY}</p>
          ) : null}
          {verification &&
          (verification.state === "verified" ||
            verification.state === "not_verified" ||
            verification.state === "inconclusive") ? (
            <>
              <p className={styles.decisionWhyLabel}>{ACTION_EXPECTED_HEADING}</p>
              <p className={styles.understandingCopy}>
                {currentValueLabel(verification.expectedValue)}
              </p>
              <p className={styles.decisionWhyLabel}>{ACTION_OBSERVED_HEADING}</p>
              <p className={styles.understandingCopy}>
                {currentValueLabel(verification.observedValue)}
              </p>
            </>
          ) : null}
          {verification?.verifiedAt ? (
            <>
              <p className={styles.decisionWhyLabel}>{ACTION_VERIFIED_AT_HEADING}</p>
              <p className={styles.understandingCopy}>
                {new Date(verification.verifiedAt).toLocaleString("en-US")}
              </p>
            </>
          ) : null}
          {verification &&
          verification.state !== "fresh_crawl_required" &&
          (verification.crawlCompletedAt || verification.crawlRunId) ? (
            <>
              <p className={styles.decisionWhyLabel}>{ACTION_CRAWL_HEADING}</p>
              <p className={styles.understandingCopy}>
                {verification.crawlCompletedAt
                  ? new Date(verification.crawlCompletedAt).toLocaleString("en-US")
                  : verification.crawlRunId}
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      {action.status === "executed" && verification?.state === "verified" && action.learning ? (
        <div className={styles.decisionWhyBlock}>
          <p className={styles.decisionWhyLabel}>{ACTION_LEARN_HEADING}</p>
          {action.learning.state === "waiting_for_data" ? (
            <p className={styles.understandingCopy}>{ACTION_LEARN_WAITING_COPY}</p>
          ) : null}
          {action.learning.state === "insufficient_data" ? (
            <p className={styles.understandingCopy}>
              {learningInsufficientCopy(action.learning.reason)}
            </p>
          ) : null}
          {action.learning.state === "observed_improvement" &&
          action.learning.baseline &&
          action.learning.comparison ? (
            <>
              <p className={styles.understandingCopy}>
                {learningObservedCopy({
                  appearancesBefore: action.learning.baseline.appearances,
                  appearancesAfter: action.learning.comparison.appearances,
                  visitsBefore: action.learning.baseline.visits,
                  visitsAfter: action.learning.comparison.visits,
                })}
              </p>
              <p className={styles.understandingCopy}>{ACTION_LEARN_OTHER_FACTORS_COPY}</p>
            </>
          ) : null}
          {action.learning.state === "observed_decline" ? (
            <p className={styles.understandingCopy}>{ACTION_LEARN_DECLINE_CAVEAT_COPY}</p>
          ) : null}
          {action.learning.state === "mixed" ? (
            <p className={styles.understandingCopy}>{ACTION_LEARN_MIXED_COPY}</p>
          ) : null}
          {action.learning.state === "no_meaningful_change" ? (
            <p className={styles.understandingCopy}>{ACTION_LEARN_NO_CHANGE_COPY}</p>
          ) : null}
          {action.learning.baseline && action.learning.comparison ? (
            <>
              <p className={styles.decisionWhyLabel}>{ACTION_LEARN_APPEARANCES_HEADING}</p>
              <p className={styles.understandingCopy}>
                {formatLearningRange(
                  action.learning.baseline.appearances,
                  action.learning.comparison.appearances,
                )}
              </p>
              <p className={styles.decisionWhyLabel}>{ACTION_LEARN_VISITS_HEADING}</p>
              <p className={styles.understandingCopy}>
                {formatLearningRange(
                  action.learning.baseline.visits,
                  action.learning.comparison.visits,
                )}
              </p>
              {action.learning.baseline.ctr != null && action.learning.comparison.ctr != null ? (
                <>
                  <p className={styles.decisionWhyLabel}>{ACTION_LEARN_CTR_HEADING}</p>
                  <p className={styles.understandingCopy}>
                    {`${action.learning.baseline.ctr.toFixed(3)} → ${action.learning.comparison.ctr.toFixed(3)}`}
                  </p>
                </>
              ) : null}
              {action.learning.baseline.position != null &&
              action.learning.comparison.position != null ? (
                <>
                  <p className={styles.decisionWhyLabel}>{ACTION_LEARN_POSITION_HEADING}</p>
                  <p className={styles.understandingCopy}>
                    {`${action.learning.baseline.position.toFixed(1)} → ${action.learning.comparison.position.toFixed(1)}`}
                  </p>
                </>
              ) : null}
            </>
          ) : null}
          {action.learning.baselinePeriod ? (
            <>
              <p className={styles.decisionWhyLabel}>{ACTION_LEARN_BASELINE_PERIOD_HEADING}</p>
              <p className={styles.understandingCopy}>
                {`${formatEvidenceDate(action.learning.baselinePeriod.start)} – ${formatEvidenceDate(action.learning.baselinePeriod.end)}`}
              </p>
            </>
          ) : null}
          {action.learning.comparisonPeriod ? (
            <>
              <p className={styles.decisionWhyLabel}>{ACTION_LEARN_COMPARISON_PERIOD_HEADING}</p>
              <p className={styles.understandingCopy}>
                {`${formatEvidenceDate(action.learning.comparisonPeriod.start)} – ${formatEvidenceDate(action.learning.comparisonPeriod.end)}`}
              </p>
            </>
          ) : null}
          <p className={styles.understandingCopy}>{OBSERVE_EVIDENCE_LAG_COPY}</p>
        </div>
      ) : null}

      <div className={styles.interpretationActions}>
        {editable ? (
          <>
            <button
              type="button"
              className={styles.scanButton}
              disabled={isWorking}
              onClick={() => void saveDraft()}
            >
              {isWorking ? "Saving…" : ACTION_SAVE_DRAFT_LABEL}
            </button>
            <button
              type="button"
              className={styles.scanButton}
              disabled={isWorking}
              onClick={() => void approve()}
            >
              {ACTION_APPROVE_LABEL}
            </button>
          </>
        ) : null}
        {canOfferExecute(action) ? (
          <button
            type="button"
            className={styles.scanButton}
            disabled={isWorking}
            onClick={() => void execute()}
          >
            {isWorking ? "Applying…" : ACTION_EXECUTE_LABEL}
          </button>
        ) : null}
        {action.verification?.canCheck ? (
          <button
            type="button"
            className={styles.scanButton}
            disabled={isWorking}
            onClick={() => void verify()}
          >
            {isWorking ? "Checking…" : ACTION_VERIFY_LABEL}
          </button>
        ) : null}
        {action.status !== "blocked" && action.status !== "executed" ? (
          <button
            type="button"
            className={styles.textButton}
            disabled={isWorking}
            onClick={() => void cancel()}
          >
            {ACTION_CANCEL_LABEL}
          </button>
        ) : null}
      </div>

      {errorMessage ? (
        <p className={styles.interpretationError} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
