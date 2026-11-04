import {
  FOUNDATION_CHECK_LABELS,
  FOUNDATION_STATUS_LABELS,
  GOOGLE_INDEXING_CHECKED_LABEL,
  GOOGLE_INDEXING_PREVIOUS_RESULTS_COPY,
  GOOGLE_INDEXING_VERDICT_LABELS,
  buildTechnicalFoundationsView,
  countGoogleIndexingVerdicts,
  formatGoogleIndexingVerdictSummary,
  formatGoogleSitemapObservationCopy,
  googleIndexingOwnerAction,
} from "@/lib/foundations/display";
import {
  selectGoogleEvidenceForWebsite,
  visibleGoogleIndexingForWebsite,
} from "@/lib/foundations/evaluate";
import type {
  CrawlFoundationsAssessment,
  FoundationStatus,
  GoogleIndexingUrlEvidence,
  StoredGoogleIndexingEvidence,
  StoredGooglePerformanceEvidence,
} from "@/lib/foundations/types";
import { formatSiteScanDate } from "@/lib/site/site-overview-view-model";
import styles from "./SitePageView.module.css";

type SiteFoundationsSectionProps = {
  websiteId: string;
  foundations: CrawlFoundationsAssessment | null;
  scanCompletedAt: string | null;
  google: StoredGooglePerformanceEvidence;
  indexing: StoredGoogleIndexingEvidence;
  indexingBusy: boolean;
  indexingCheckAvailable: boolean;
  onCheckIndexing: () => void;
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

function indexingDateLabel(value: string | null): string {
  return value ? formatSiteScanDate(value) : "not reported";
}

function IndexingUrlRow({ item }: { item: GoogleIndexingUrlEvidence }) {
  return (
    <li className={styles.indexingUrlItem}>
      <p className={styles.foundationsSummary}>
        {item.role === "homepage" ? "Homepage" : "Important page"}: {item.url}
      </p>
      <p className={styles.foundationsDetail}>
        {GOOGLE_INDEXING_VERDICT_LABELS[item.verdict]}
        {item.reason ? ` — ${item.reason}` : ""}
      </p>
      <p className={styles.foundationsDetail}>
        Checked on {indexingDateLabel(item.inspectedAt)}. Last Google crawl:{" "}
        {indexingDateLabel(item.lastCrawlTime)}.
      </p>
      {item.canonicalMismatch ? (
        <p className={styles.foundationsDetail}>
          Google-selected canonical differs
          {item.googleCanonical ? ` (${item.googleCanonical})` : ""}.
          {item.userCanonical ? ` Page canonical: ${item.userCanonical}.` : ""}
        </p>
      ) : null}
      {item.indexingState ? (
        <p className={styles.foundationsDetail}>
          Google indexing directive: {item.indexingState}. INDEXING_ALLOWED is not proof that the
          URL is indexed.
        </p>
      ) : null}
    </li>
  );
}

export default function SiteFoundationsSection({
  websiteId,
  foundations,
  scanCompletedAt,
  google,
  indexing,
  indexingBusy,
  indexingCheckAvailable,
  onCheckIndexing,
}: SiteFoundationsSectionProps) {
  const visibleIndexing = visibleGoogleIndexingForWebsite(indexing, websiteId);
  const view = buildTechnicalFoundationsView(
    foundations,
    selectGoogleEvidenceForWebsite(google, websiteId),
    visibleIndexing.evidence,
  );
  const indexingEvidence = visibleIndexing.evidence;
  const indexingAction = googleIndexingOwnerAction({
    available: indexingCheckAvailable,
    busy: indexingBusy,
    evidence: indexingEvidence,
    loadError: visibleIndexing.loadError,
  });
  const showCompletedChrome =
    indexingAction.state === "completed" && indexingEvidence?.kind === "checked";
  const showPreviousResultsNote =
    indexingAction.state === "error" && indexingEvidence?.kind === "checked";

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
            {check.id === "google_indexing" ? (
              <div className={styles.indexingPanel}>
                {showCompletedChrome && indexingEvidence?.kind === "checked" ? (
                  <>
                    <p className={styles.indexingCheckedLabel}>{GOOGLE_INDEXING_CHECKED_LABEL}</p>
                    <p className={styles.foundationsDetail}>
                      Checked {formatSiteScanDate(indexingEvidence.inspectedAt)}.
                    </p>
                    <p className={styles.foundationsSummary}>
                      {formatGoogleIndexingVerdictSummary(
                        countGoogleIndexingVerdicts(indexingEvidence.urls),
                      )}
                    </p>
                  </>
                ) : null}
                {visibleIndexing.loadError ? (
                  <p className={styles.foundationsDetail} role="alert">
                    {visibleIndexing.loadError}
                  </p>
                ) : null}
                {showPreviousResultsNote ? (
                  <p className={styles.foundationsDetail}>{GOOGLE_INDEXING_PREVIOUS_RESULTS_COPY}</p>
                ) : null}
                {indexingEvidence?.kind === "checked" ? (
                  <>
                    <ul className={styles.indexingUrlList}>
                      {indexingEvidence.urls.map((item) => (
                        <IndexingUrlRow key={item.url} item={item} />
                      ))}
                    </ul>
                    <div className={styles.indexingSitemap}>
                      <p className={styles.foundationsSummary}>Sitemap status in Search Console</p>
                      <p className={styles.foundationsDetail}>
                        {formatGoogleSitemapObservationCopy(indexingEvidence.sitemap)}
                      </p>
                      {indexingEvidence.sitemap.sitemaps.map((entry) => (
                        <p key={entry.path} className={styles.foundationsDetail}>
                          {entry.path}
                          {entry.lastSubmitted
                            ? ` · last submitted ${indexingDateLabel(entry.lastSubmitted)}`
                            : ""}
                          {entry.lastDownloaded
                            ? ` · last downloaded ${indexingDateLabel(entry.lastDownloaded)}`
                            : ""}
                          {entry.pending ? " · pending" : ""}
                          {entry.errors != null ? ` · ${entry.errors} errors` : ""}
                          {entry.warnings != null ? ` · ${entry.warnings} warnings` : ""}
                          {entry.submittedUrlCount != null
                            ? ` · ${entry.submittedUrlCount} submitted URLs`
                            : ""}
                        </p>
                      ))}
                      {indexingEvidence.sitemap.crawledSitemapUrls.length > 0 ? (
                        <p className={styles.foundationsDetail}>
                          Foundfy crawl sitemaps: {indexingEvidence.sitemap.crawledSitemapUrls.join(", ")}
                        </p>
                      ) : null}
                    </div>
                    {indexingEvidence.reused ? (
                      <p className={styles.foundationsDetail}>
                        Foundfy reused the last Google indexing check from this session. That is
                        still not a live URL test.
                      </p>
                    ) : null}
                  </>
                ) : null}
                {indexingAction.visible ? (
                  <button
                    type="button"
                    className={
                      indexingAction.emphasis === "secondary"
                        ? `${styles.observeConnectButton} ${styles.indexingSecondaryButton}`
                        : styles.observeConnectButton
                    }
                    onClick={onCheckIndexing}
                    disabled={indexingAction.disabled}
                  >
                    {indexingAction.label}
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
