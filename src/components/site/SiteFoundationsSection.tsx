"use client";

import { useEffect, useState } from "react";
import {
  FOUNDATION_CHECK_LABELS,
  FOUNDATION_STATUS_LABELS,
  buildTechnicalFoundationsView,
} from "@/lib/foundations/display";
import type {
  CrawlFoundationsAssessment,
  FoundationStatus,
  GooglePerformanceEvidenceInput,
} from "@/lib/foundations/types";
import { formatSiteScanDate } from "@/lib/site/site-overview-view-model";
import styles from "./SitePageView.module.css";

type SiteFoundationsSectionProps = {
  websiteId: string;
  foundations: CrawlFoundationsAssessment | null;
  scanCompletedAt: string | null;
};

function googleInputFromResponse(
  status: number,
  payload: {
    status?: string;
    empty?: boolean;
    windowDays?: number;
    summary?: { queriesReported?: number };
  },
): GooglePerformanceEvidenceInput {
  if (status === 401) {
    return { kind: "no_session" };
  }

  if (status === 403) {
    return { kind: "not_connected" };
  }

  if (status < 200 || status >= 300) {
    return { kind: "unavailable" };
  }

  if (payload.status === "not_synced") {
    return { kind: "not_synced" };
  }

  if (payload.empty) {
    return { kind: "empty", windowDays: payload.windowDays ?? 28 };
  }

  return {
    kind: "reported",
    windowDays: payload.windowDays ?? 28,
    queriesReported: payload.summary?.queriesReported ?? 0,
  };
}

function statusClassName(status: FoundationStatus): string {
  switch (status) {
    case "verified":
      return styles.foundationStatusVerified;
    case "needs_attention":
      return styles.foundationStatusNeedsAttention;
    case "not_checked":
      return styles.foundationStatusNotChecked;
    case "data_unavailable":
      return styles.foundationStatusUnavailable;
  }
}

export default function SiteFoundationsSection({
  websiteId,
  foundations,
  scanCompletedAt,
}: SiteFoundationsSectionProps) {
  const [google, setGoogle] = useState<GooglePerformanceEvidenceInput | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGooglePerformance() {
      try {
        const response = await fetch(
          `/api/websites/${websiteId}/observe/search-analytics`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          status?: string;
          empty?: boolean;
          windowDays?: number;
          summary?: { queriesReported?: number };
        };

        if (cancelled) {
          return;
        }

        setGoogle(googleInputFromResponse(response.status, payload));
      } catch {
        if (!cancelled) {
          setGoogle({ kind: "unavailable" });
        }
      }
    }

    void loadGooglePerformance();
    return () => {
      cancelled = true;
    };
  }, [websiteId]);

  const view = buildTechnicalFoundationsView(foundations, google);

  return (
    <section className={styles.section} aria-labelledby="site-foundations">
      <div className={styles.sectionIntro}>
        <h2 id="site-foundations" className={styles.sectionHeading}>
          {view.heading}
        </h2>
        <p className={styles.sectionMeta}>
          {view.intro}
          {scanCompletedAt ? ` Latest usable scan: ${formatSiteScanDate(scanCompletedAt)}.` : ""}
        </p>
        {view.sampleCopy ? <p className={styles.sectionMeta}>{view.sampleCopy}</p> : null}
      </div>

      <ul className={styles.foundationsList}>
        {view.checks.map((check) => (
          <li key={check.id} className={styles.foundationsItem}>
            <div className={styles.foundationsItemHeader}>
              <h3 className={styles.foundationsCheckLabel}>
                {FOUNDATION_CHECK_LABELS[check.id]}
              </h3>
              <p className={`${styles.foundationsStatus} ${statusClassName(check.status)}`}>
                {FOUNDATION_STATUS_LABELS[check.status]}
              </p>
            </div>
            <p className={styles.foundationsSummary}>{check.summary}</p>
            {check.detail ? <p className={styles.foundationsDetail}>{check.detail}</p> : null}
            {check.id === "sitemap" && view.sitemapUrls.length > 0 ? (
              <>
                <ul className={styles.foundationsSitemapList}>
                  {view.sitemapUrls.map((url) => (
                    <li key={url}>{url}</li>
                  ))}
                </ul>
                {view.sitemapUrlCount > view.sitemapUrls.length ? (
                  <p className={styles.foundationsDetail}>
                    and {view.sitemapUrlCount - view.sitemapUrls.length} more listed in the sitemap
                  </p>
                ) : null}
              </>
            ) : null}
          </li>
        ))}
      </ul>

      <div className={styles.foundationsNextStep}>
        <h3 className={styles.subsectionHeading}>What should happen next</h3>
        <p className={styles.foundationsSummary}>{view.nextStep.message}</p>
      </div>
    </section>
  );
}
