"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ACTION_ERROR_COPY,
  ACTION_HISTORY_HEADING,
} from "@/lib/actions/display";
import type { CanonicalReviewView } from "@/lib/actions/review-types";
import type { ActionPreviewView } from "@/lib/actions/types";
import SiteActionPanel from "./SiteActionPanel";
import SiteCanonicalReviewPanel from "./SiteCanonicalReviewPanel";
import styles from "./SitePageView.module.css";

type SiteActionsSectionProps = {
  websiteId: string;
  refreshKey?: number;
};

type HistoryItem =
  | { kind: "action"; id: string; at: string; action: ActionPreviewView }
  | { kind: "review"; id: string; at: string; review: CanonicalReviewView };

export default function SiteActionsSection({
  websiteId,
  refreshKey = 0,
}: SiteActionsSectionProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [visible, setVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [actionsResponse, reviewsResponse] = await Promise.all([
        fetch(`/api/websites/${websiteId}/actions`, { cache: "no-store" }),
        fetch(`/api/websites/${websiteId}/reviews`, { cache: "no-store" }),
      ]);

      if (actionsResponse.status === 401 || actionsResponse.status === 403) {
        setVisible(false);
        setItems([]);
        return;
      }

      if (reviewsResponse.status === 401 || reviewsResponse.status === 403) {
        setVisible(false);
        setItems([]);
        return;
      }

      const actionsPayload = (await actionsResponse.json()) as {
        actions?: ActionPreviewView[];
        error?: string;
      };
      const reviewsPayload = (await reviewsResponse.json()) as {
        reviews?: CanonicalReviewView[];
        error?: string;
      };

      if (!actionsResponse.ok && !reviewsResponse.ok) {
        setVisible(true);
        setErrorMessage(actionsPayload.error ?? reviewsPayload.error ?? ACTION_ERROR_COPY);
        return;
      }

      const next: HistoryItem[] = [];
      if (actionsResponse.ok) {
        for (const action of actionsPayload.actions ?? []) {
          next.push({
            kind: "action",
            id: action.id,
            at: action.createdAt,
            action,
          });
        }
      }
      if (reviewsResponse.ok) {
        for (const review of reviewsPayload.reviews ?? []) {
          next.push({
            kind: "review",
            id: review.id,
            at: review.reviewedAt,
            review,
          });
        }
      }

      next.sort((a, b) => b.at.localeCompare(a.at));
      setVisible(true);
      setErrorMessage(
        actionsResponse.ok
          ? reviewsResponse.ok
            ? null
            : (reviewsPayload.error ?? null)
          : (actionsPayload.error ?? ACTION_ERROR_COPY),
      );
      setItems(next);
    } catch {
      setVisible(false);
    }
  }, [websiteId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!visible || (items.length === 0 && !errorMessage)) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="site-actions">
      <div className={styles.sectionIntro}>
        <h2 id="site-actions" className={styles.sectionHeading}>
          {ACTION_HISTORY_HEADING}
        </h2>
      </div>

      {items.length > 0 ? (
        <ol className={styles.decisionList}>
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className={styles.decisionItem}>
              {item.kind === "action" ? (
                <SiteActionPanel
                  websiteId={websiteId}
                  decision={item.action.decision}
                  action={item.action}
                  current={false}
                  onActionChange={(next) => {
                    setItems((current) => {
                      if (!next) {
                        return current.filter((entry) => entry.id !== item.id);
                      }
                      return current.map((entry) =>
                        entry.kind === "action" && entry.id === next.id
                          ? { ...entry, action: next }
                          : entry,
                      );
                    });
                  }}
                />
              ) : (
                <SiteCanonicalReviewPanel
                  websiteId={websiteId}
                  decisionId={item.review.decisionId}
                  identity={{
                    pageUrl: item.review.pageUrl,
                    canonicalUrl: item.review.canonicalUrl,
                  }}
                  review={item.review}
                  interactive={false}
                />
              )}
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
