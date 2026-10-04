"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ACTION_ERROR_COPY,
  ACTION_HISTORY_HEADING,
} from "@/lib/actions/display";
import type { ActionPreviewView } from "@/lib/actions/types";
import SiteActionPanel from "./SiteActionPanel";
import styles from "./SitePageView.module.css";

type SiteActionsSectionProps = {
  websiteId: string;
  refreshKey?: number;
};

export default function SiteActionsSection({
  websiteId,
  refreshKey = 0,
}: SiteActionsSectionProps) {
  const [actions, setActions] = useState<ActionPreviewView[]>([]);
  const [visible, setVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/websites/${websiteId}/actions`, {
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        setVisible(false);
        setActions([]);
        return;
      }

      const payload = (await response.json()) as {
        actions?: ActionPreviewView[];
        error?: string;
      };
      if (!response.ok) {
        setVisible(true);
        setErrorMessage(payload.error ?? ACTION_ERROR_COPY);
        return;
      }

      setVisible(true);
      setErrorMessage(null);
      setActions(payload.actions ?? []);
    } catch {
      setVisible(false);
    }
  }, [websiteId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!visible || (actions.length === 0 && !errorMessage)) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="site-actions">
      <div className={styles.sectionIntro}>
        <h2 id="site-actions" className={styles.sectionHeading}>
          {ACTION_HISTORY_HEADING}
        </h2>
      </div>

      {actions.length > 0 ? (
        <ol className={styles.decisionList}>
          {actions.map((action) => (
            <li key={action.id} className={styles.decisionItem}>
              <SiteActionPanel
                websiteId={websiteId}
                decision={action.decision}
                action={action}
                current={false}
                onActionChange={(next) => {
                  setActions((current) => {
                    if (!next) {
                      return current.filter((item) => item.id !== action.id);
                    }
                    return current.map((item) => (item.id === next.id ? next : item));
                  });
                }}
              />
            </li>
          ))}
        </ol>
      ) : null}

      {errorMessage ? (
        <p className={styles.interpretationError} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
