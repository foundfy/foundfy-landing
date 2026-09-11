import Link from "next/link";
import {
  formatHistoryFindingsLabel,
  formatHistoryStatusLabel,
  formatSiteScanDate,
  isHistoryRowClickable,
} from "@/lib/site/site-overview-view-model";
import type { WebsiteOverview } from "@/lib/websites/types";
import styles from "./SitePageView.module.css";

type SiteScanHistorySectionProps = {
  scanHistory: WebsiteOverview["scanHistory"];
};

export default function SiteScanHistorySection({
  scanHistory,
}: SiteScanHistorySectionProps) {
  if (scanHistory.length === 0) {
    return (
      <section className={styles.section} aria-labelledby="site-scan-history">
        <h2 id="site-scan-history" className={styles.sectionHeading}>
          Scan history
        </h2>
        <p className={styles.sectionMeta}>No scans yet.</p>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="site-scan-history">
      <h2 id="site-scan-history" className={styles.sectionHeading}>
        Scan history
      </h2>
      <ul className={styles.historyList}>
        {scanHistory.map((item) => {
          const findingsLabel = formatHistoryFindingsLabel(item.findingsCount);
          const statusLabel = formatHistoryStatusLabel(item.status);
          const timestamp = formatSiteScanDate(item.completedAt ?? item.createdAt);
          const clickable = isHistoryRowClickable(item);
          const metaParts = [
            statusLabel,
            item.pagesCrawled > 0 ? `${item.pagesCrawled} pages` : null,
            findingsLabel,
          ].filter(Boolean);

          const rowContent = (
            <>
              <span className={styles.historyDate}>{timestamp}</span>
              <span className={styles.historyMeta}>{metaParts.join(" · ")}</span>
            </>
          );

          return (
            <li
              key={item.crawlRunId}
              className={`${styles.historyItem} ${
                item.status === "failed" ? styles.historyItemFailed : ""
              }`.trim()}
            >
              {clickable ? (
                <Link href={`/scan/${item.crawlRunId}`} className={styles.historyLink}>
                  {rowContent}
                </Link>
              ) : (
                <div className={styles.historyStaticRow}>{rowContent}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
