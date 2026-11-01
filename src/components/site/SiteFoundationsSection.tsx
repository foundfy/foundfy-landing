import {
  FOUNDATION_CHECK_LABELS,
  FOUNDATION_STATUS_LABELS,
  buildTechnicalFoundationsView,
} from "@/lib/foundations/display";
import { selectGoogleEvidenceForWebsite } from "@/lib/foundations/evaluate";
import type {
  CrawlFoundationsAssessment,
  FoundationStatus,
  StoredGooglePerformanceEvidence,
} from "@/lib/foundations/types";
import { formatSiteScanDate } from "@/lib/site/site-overview-view-model";
import styles from "./SitePageView.module.css";

type SiteFoundationsSectionProps = {
  websiteId: string;
  foundations: CrawlFoundationsAssessment | null;
  scanCompletedAt: string | null;
  google: StoredGooglePerformanceEvidence;
};

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
  google,
}: SiteFoundationsSectionProps) {
  const view = buildTechnicalFoundationsView(
    foundations,
    selectGoogleEvidenceForWebsite(google, websiteId),
  );

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
    </section>
  );
}
