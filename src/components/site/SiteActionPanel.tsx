"use client";

import { useEffect, useState } from "react";
import {
  ACTION_APPROVE_LABEL,
  ACTION_APPROVED_COPY,
  ACTION_BLOCKED_COPY,
  ACTION_CANCEL_LABEL,
  ACTION_CURRENT_LABEL,
  ACTION_CURRENT_NONE_LABEL,
  ACTION_ERROR_COPY,
  ACTION_EXECUTE_DISABLED,
  ACTION_EXECUTE_LABEL,
  ACTION_EXECUTED_COPY,
  ACTION_FIELD_LABEL,
  ACTION_MUTATION_HEADING,
  ACTION_PAGE_HEADING,
  ACTION_PREPARE_LABEL,
  ACTION_PROPOSED_LABEL,
  ACTION_SAVE_DRAFT_LABEL,
  ACTION_UNSAFE_STALE_COPY,
  ACTION_VERIFY_HEADING,
  ACTION_WHY_HEADING,
} from "@/lib/actions/display";
import { META_DESCRIPTION_MAX_LENGTH } from "@/lib/actions/config";
import type { ActionPreviewView } from "@/lib/actions/types";
import type { DecisionView } from "@/lib/decisions/types";
import styles from "./SitePageView.module.css";

type SiteActionPanelProps = {
  websiteId: string;
  decision: DecisionView;
  action: ActionPreviewView | null;
  current: boolean;
  onActionChange: (action: ActionPreviewView | null) => void;
};

function currentValueLabel(value: string | null): string {
  return value?.trim() ? value : ACTION_CURRENT_NONE_LABEL;
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

  if (!action) {
    if (!current || decision.supportedActionType !== "update_meta_description") {
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

  return (
    <div className={styles.actionPanel}>
      {action.status === "blocked" ? (
        <p className={styles.sectionMeta}>{ACTION_BLOCKED_COPY}</p>
      ) : null}
      {action.status === "executed" ? (
        <p className={styles.sectionMeta}>{ACTION_EXECUTED_COPY}</p>
      ) : null}
      {action.status === "approved" && action.executeBlockedReason === "unsafe_stale" ? (
        <p className={styles.sectionMeta}>{ACTION_UNSAFE_STALE_COPY}</p>
      ) : null}
      {action.status === "approved" && action.executeBlockedReason === "adapter_not_connected" ? (
        <p className={styles.sectionMeta}>{ACTION_EXECUTE_DISABLED}</p>
      ) : null}
      {action.status === "approved" && action.executeAvailable ? (
        <p className={styles.sectionMeta}>{ACTION_APPROVED_COPY}</p>
      ) : null}

      <div className={styles.decisionWhyBlock}>
        <p className={styles.decisionWhyLabel}>{ACTION_PAGE_HEADING}</p>
        <p className={styles.understandingCopy}>{action.targetPage.url}</p>
      </div>

      <div className={styles.decisionWhyBlock}>
        <p className={styles.decisionWhyLabel}>{ACTION_FIELD_LABEL}</p>
        <p className={styles.understandingCopy}>{ACTION_CURRENT_LABEL}</p>
        <p className={styles.understandingCopy}>{currentValueLabel(action.currentValue)}</p>
      </div>

      {editable ? (
        <label className={styles.interpretationLabel}>
          {ACTION_PROPOSED_LABEL}
          <textarea
            className={styles.interpretationInput}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            maxLength={META_DESCRIPTION_MAX_LENGTH}
            disabled={isWorking}
          />
        </label>
      ) : (
        <div className={styles.decisionWhyBlock}>
          <p className={styles.decisionWhyLabel}>{ACTION_PROPOSED_LABEL}</p>
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
        {action.executeAvailable ? (
          <button
            type="button"
            className={styles.scanButton}
            disabled={isWorking}
            onClick={() => void execute()}
          >
            {isWorking ? "Applying…" : ACTION_EXECUTE_LABEL}
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
