import Link from "next/link";
import type { WebsiteOverview } from "@/lib/websites/types";
import styles from "./SitePageView.module.css";

type SiteActiveScanNoticeProps = {
  activeScan: NonNullable<WebsiteOverview["activeScan"]>;
};

export default function SiteActiveScanNotice({ activeScan }: SiteActiveScanNoticeProps) {
  const statusCopy =
    activeScan.status === "running" ? "Scan in progress" : "Scan queued";

  return (
    <aside className={styles.activeScanNotice} aria-label="Active scan">
      <div className={styles.activeScanCopy}>
        <span className={styles.activeScanPulse} aria-hidden="true" />
        <p className={styles.activeScanTitle}>{statusCopy}</p>
        <p className={styles.activeScanMeta}>
          {activeScan.pagesCrawled} / {activeScan.maxPages} pages crawled
        </p>
      </div>
      <Link href={`/scan/${activeScan.crawlRunId}`} className={styles.textLink}>
        View live scan →
      </Link>
    </aside>
  );
}
