"use client";

import {
  buildSiteOverviewLinks,
  shouldShowActiveScanBanner,
  shouldShowCurrentState,
} from "@/lib/site/site-overview-view-model";
import { useRescanNavigation } from "@/hooks/useRescanNavigation";
import { useWebsiteOverviewLoader } from "@/hooks/useWebsiteOverviewLoader";
import shellStyles from "@/components/persistent/PersistentPageShell.module.css";
import SiteActiveScanNotice from "./SiteActiveScanNotice";
import SiteHeader from "./SiteHeader";
import SiteProgressSection from "./SiteProgressSection";
import SiteScanHistorySection from "./SiteScanHistorySection";
import SiteWhatMattersSection from "./SiteWhatMattersSection";
import styles from "./SitePageView.module.css";

type SitePageViewProps = {
  websiteId: string;
};

export default function SitePageView({ websiteId }: SitePageViewProps) {
  const { state } = useWebsiteOverviewLoader(websiteId);
  const { scanAgain, isRescanning, rescanError } = useRescanNavigation(websiteId);

  if (state.phase === "loading") {
    return <p className={shellStyles.loading}>Loading site report…</p>;
  }

  if (state.phase === "not_found") {
    return (
      <p className={shellStyles.errorMessage} role="alert">
        {state.errorMessage}
      </p>
    );
  }

  if (state.phase === "error") {
    return (
      <p className={shellStyles.errorMessage} role="alert">
        {state.errorMessage}
      </p>
    );
  }

  const { overview } = state;
  const links = buildSiteOverviewLinks(overview);

  return (
    <article className={styles.page}>
      <SiteHeader
        website={overview.website}
        latestUsableScan={overview.latestUsableScan}
        isRescanning={isRescanning}
        onRescan={() => void scanAgain()}
      />

      {shouldShowActiveScanBanner(overview) && overview.activeScan ? (
        <SiteActiveScanNotice activeScan={overview.activeScan} />
      ) : null}

      <SiteWhatMattersSection overview={overview} latestScanHref={links.latestScanHref} />

      {shouldShowCurrentState(overview) && overview.latestUsableScan ? (
        <SiteProgressSection latestUsableScan={overview.latestUsableScan} />
      ) : null}

      <SiteScanHistorySection scanHistory={overview.scanHistory} />

      {rescanError ? (
        <p className={shellStyles.errorMessage} role="alert">
          {rescanError}
        </p>
      ) : null}
    </article>
  );
}
