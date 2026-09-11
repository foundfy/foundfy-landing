"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseRescanResponse } from "@/lib/site/rescan-action";
import {
  buildSiteOverviewLinks,
  shouldShowActiveScanBanner,
  shouldShowCurrentState,
} from "@/lib/site/site-overview-view-model";
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
  const router = useRouter();
  const { state } = useWebsiteOverviewLoader(websiteId);
  const [isRescanning, setIsRescanning] = useState(false);
  const [rescanError, setRescanError] = useState<string | null>(null);

  const handleRescan = async () => {
    if (isRescanning) {
      return;
    }

    setIsRescanning(true);
    setRescanError(null);

    try {
      const response = await fetch(`/api/websites/${websiteId}/scan`, {
        method: "POST",
        cache: "no-store",
      });
      const payload = await response.json();
      const result = parseRescanResponse(response, payload);

      if (!result.ok) {
        setRescanError(result.error);
        return;
      }

      router.push(`/scan/${result.crawlRunId}`);
    } catch {
      setRescanError("Unable to start scan right now.");
    } finally {
      setIsRescanning(false);
    }
  };

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
        onRescan={() => void handleRescan()}
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
