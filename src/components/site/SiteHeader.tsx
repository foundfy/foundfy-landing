import Link from "next/link";
import { getSiteRescanLabel } from "@/lib/analysis/landing-persistent-bridge";
import { formatSiteScanDate } from "@/lib/site/site-overview-view-model";
import type { WebsiteOverview } from "@/lib/websites/types";
import styles from "./SitePageView.module.css";

type SiteHeaderProps = {
  website: WebsiteOverview["website"];
  latestUsableScan: WebsiteOverview["latestUsableScan"];
  isRescanning: boolean;
  onRescan: () => void;
};

export default function SiteHeader({
  website,
  latestUsableScan,
  isRescanning,
  onRescan,
}: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.homeLink}>
        ← Foundfy
      </Link>

      <div className={styles.headerMain}>
        <div className={styles.headerIdentity}>
          <h1 className={styles.title}>{website.hostname}</h1>
          {website.displayUrl !== `https://${website.hostname}` &&
          website.displayUrl !== `https://${website.hostname}/` ? (
            <p className={styles.displayUrl}>{website.displayUrl}</p>
          ) : null}
          {latestUsableScan ? (
            <p className={styles.lastScanMeta}>
              Last successful scan · {formatSiteScanDate(latestUsableScan.completedAt)}
            </p>
          ) : (
            <p className={styles.lastScanMeta}>No successful scan yet</p>
          )}
        </div>

        <button
          type="button"
          className={styles.scanButton}
          onClick={onRescan}
          disabled={isRescanning}
        >
          {isRescanning ? "Starting scan…" : getSiteRescanLabel()}
        </button>
      </div>
    </header>
  );
}
