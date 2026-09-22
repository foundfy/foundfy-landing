"use client";

import { useCallback, useEffect, useState } from "react";
import type { ObserveNotice } from "@/lib/gsc/config";
import {
  OBSERVE_CONNECT_LABEL,
  OBSERVE_CONNECTED_NEXT,
  OBSERVE_CONNECTED_TITLE,
  OBSERVE_DISCONNECT_LABEL,
  OBSERVE_NOTICE_COPY,
  OBSERVE_SECTION_HEADING,
} from "@/lib/gsc/display";
import type { ObserveOwnerView } from "@/lib/gsc/types";
import styles from "./SitePageView.module.css";

type SiteObserveSectionProps = {
  websiteId: string;
  notice: ObserveNotice | null;
};

type ObserveLoadState =
  | { phase: "loading" }
  | { phase: "disconnected" }
  | { phase: "connected"; view: ObserveOwnerView }
  | { phase: "error"; message: string };

export default function SiteObserveSection({
  websiteId,
  notice,
}: SiteObserveSectionProps) {
  const [state, setState] = useState<ObserveLoadState>({ phase: "loading" });
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/websites/${websiteId}/observe`, {
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        setState({ phase: "disconnected" });
        return;
      }

      const payload = (await response.json()) as ObserveOwnerView & { error?: string };

      if (!response.ok) {
        setState({
          phase: "error",
          message: payload.error ?? "Unable to load Google connection state.",
        });
        return;
      }

      if (payload.status !== "google_connected") {
        setState({ phase: "disconnected" });
        return;
      }

      setState({ phase: "connected", view: payload });
    } catch {
      setState({
        phase: "error",
        message: "Unable to load Google connection state.",
      });
    }
  }, [websiteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const disconnect = async () => {
    setIsDisconnecting(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/websites/${websiteId}/observe/disconnect`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setActionError(payload.error ?? "Unable to disconnect.");
        return;
      }

      setState({ phase: "disconnected" });
    } catch {
      setActionError("Unable to disconnect.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const noticeCopy = notice ? OBSERVE_NOTICE_COPY[notice] : null;

  return (
    <section className={styles.section} aria-labelledby="site-observe">
      <div className={styles.sectionIntro}>
        <h2 id="site-observe" className={styles.sectionHeading}>
          {OBSERVE_SECTION_HEADING}
        </h2>
      </div>

      {state.phase === "loading" ? (
        <p className={styles.emptyStateCopy}>Checking Google connection…</p>
      ) : null}

      {state.phase === "disconnected" ? (
        <div className={styles.emptyStateBlock}>
          <p className={styles.emptyStateCopy}>
            Connect Google to begin observing how people discover this site.
          </p>
          <a
            className={styles.observeConnectButton}
            href={`/api/websites/${websiteId}/observe/connect`}
          >
            {OBSERVE_CONNECT_LABEL}
          </a>
        </div>
      ) : null}

      {state.phase === "connected" ? (
        <div className={styles.emptyStateBlock}>
          <p className={styles.emptyStateTitle}>{OBSERVE_CONNECTED_TITLE}</p>
          {state.view.email ? (
            <p className={styles.sectionMeta}>{state.view.email}</p>
          ) : null}
          <p className={styles.emptyStateCopy}>{OBSERVE_CONNECTED_NEXT}</p>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => void disconnect()}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? "Disconnecting…" : OBSERVE_DISCONNECT_LABEL}
          </button>
        </div>
      ) : null}

      {state.phase === "error" ? (
        <p className={styles.interpretationError} role="alert">
          {state.message}
        </p>
      ) : null}

      {noticeCopy && notice && notice !== "connected" ? (
        <p
          className={
            notice === "disconnected" ? styles.sectionMeta : styles.interpretationError
          }
          role="status"
        >
          {noticeCopy}
        </p>
      ) : null}

      {actionError ? (
        <p className={styles.interpretationError} role="alert">
          {actionError}
        </p>
      ) : null}
    </section>
  );
}
