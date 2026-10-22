"use client";

import { useCallback, useEffect, useState } from "react";
import {
  OBSERVE_ALREADY_RUNNING_COPY,
  OBSERVE_CHECK_AGAIN_LABEL,
  OBSERVE_NO_CANDIDATES_COPY,
  OBSERVE_OBSERVED_COPY,
  OBSERVE_REASON_GSC_SUPPORT,
  OBSERVE_STALE_SOURCE_COPY,
  OBSERVE_THIS_PAGE_LABEL,
} from "@/lib/observe/display";
import type { ObserveCandidatesView, ObserveCandidate } from "@/lib/observe/types";
import styles from "./SitePageView.module.css";

export default function SiteObserveIdeaPanel(input: {
  websiteId: string;
  ideaId: string;
  enabled: boolean;
  isSaving: boolean;
  onBusy: (busy: boolean) => void;
  onReload: () => Promise<void>;
}) {
  const [view, setView] = useState<ObserveCandidatesView | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!input.enabled) {
      setView(null);
      return;
    }
    try {
      const response = await fetch(
        `/api/websites/${input.websiteId}/research/ideas/${input.ideaId}/observe-candidates`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as ObserveCandidatesView & { error?: string };
      if (!response.ok) {
        setErrorMessage(payload.error ?? OBSERVE_NO_CANDIDATES_COPY);
        return;
      }
      setView(payload);
      setErrorMessage(null);
    } catch {
      setErrorMessage(OBSERVE_NO_CANDIDATES_COPY);
    }
  }, [input.enabled, input.ideaId, input.websiteId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!input.enabled) {
    return null;
  }

  const observe = async (candidate: ObserveCandidate) => {
    input.onBusy(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/websites/${input.websiteId}/research/ideas/${input.ideaId}/observe`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ queueItemId: candidate.queueItemId }),
        },
      );
      const payload = (await response.json()) as { error?: string; copy?: string };
      if (!response.ok) {
        setErrorMessage(payload.error ?? OBSERVE_NO_CANDIDATES_COPY);
        return;
      }
      await load();
      await input.onReload();
      if (payload.copy) {
        setErrorMessage(null);
      }
    } catch {
      setErrorMessage(OBSERVE_NO_CANDIDATES_COPY);
    } finally {
      input.onBusy(false);
    }
  };

  const checkAgain = async (observationId: string) => {
    input.onBusy(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/websites/${input.websiteId}/research/ideas/${input.ideaId}/inspect`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ targetedObservationId: observationId }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setErrorMessage(payload.error ?? OBSERVE_STALE_SOURCE_COPY);
        return;
      }
      await input.onReload();
    } catch {
      setErrorMessage(OBSERVE_STALE_SOURCE_COPY);
    } finally {
      input.onBusy(false);
    }
  };

  return (
    <div className={styles.understandingBlock}>
      {errorMessage ? (
        <p className={styles.sectionMeta} role="alert">
          {errorMessage}
        </p>
      ) : null}
      {view?.status === "stale_source" ? (
        <p className={styles.sectionMeta}>{view.copy}</p>
      ) : null}
      {view?.status === "already_running" ? (
        <p className={styles.sectionMeta}>{OBSERVE_ALREADY_RUNNING_COPY}</p>
      ) : null}
      {view?.status === "observed" && view.observation ? (
        <div className={styles.interpretationActions}>
          <p className={styles.understandingCopy}>{OBSERVE_OBSERVED_COPY}</p>
          <p className={styles.sectionMeta}>{view.observation.requestedUrl}</p>
          <button
            className={styles.scanButton}
            type="button"
            disabled={input.isSaving}
            onClick={() => {
              void checkAgain(view.observation.id);
            }}
          >
            {OBSERVE_CHECK_AGAIN_LABEL}
          </button>
        </div>
      ) : null}
      {view?.status === "candidates" ? (
        view.candidates.length === 0 ? (
          <p className={styles.sectionMeta}>{view.copy ?? OBSERVE_NO_CANDIDATES_COPY}</p>
        ) : (
          <ul className={styles.opportunityList}>
            {view.candidates.map((candidate) => (
              <li key={candidate.queueItemId} className={styles.opportunityItem}>
                <p className={styles.understandingCopy}>{candidate.url}</p>
                <p className={styles.sectionMeta}>{candidate.reasonCopy}</p>
                {candidate.gscSupport ? (
                  <p className={styles.sectionMeta}>{OBSERVE_REASON_GSC_SUPPORT}</p>
                ) : null}
                <div className={styles.interpretationActions}>
                  <button
                    className={styles.scanButton}
                    type="button"
                    disabled={input.isSaving}
                    onClick={() => {
                      void observe(candidate);
                    }}
                  >
                    {OBSERVE_THIS_PAGE_LABEL}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
