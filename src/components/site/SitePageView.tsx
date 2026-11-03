"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildSiteOverviewLinks,
  shouldShowActiveScanBanner,
  shouldShowCurrentState,
} from "@/lib/site/site-overview-view-model";
import { useGoogleIndexingEvidence } from "@/hooks/useGoogleIndexingEvidence";
import { useGooglePerformanceEvidence } from "@/hooks/useGooglePerformanceEvidence";
import { useRescanNavigation } from "@/hooks/useRescanNavigation";
import { useWebsiteOverviewLoader } from "@/hooks/useWebsiteOverviewLoader";
import { selectGoogleEvidenceForWebsite, visibleGoogleIndexingForWebsite } from "@/lib/foundations/evaluate";
import shellStyles from "@/components/persistent/PersistentPageShell.module.css";
import SiteActiveScanNotice from "./SiteActiveScanNotice";
import SiteHeader from "./SiteHeader";
import SiteProgressSection from "./SiteProgressSection";
import SiteScanHistorySection from "./SiteScanHistorySection";
import { shouldShowWebsiteGoals } from "@/lib/goals/display";
import SiteGoalsSection from "./SiteGoalsSection";
import SiteUnderstandingSection from "./SiteUnderstandingSection";
import SiteWhatMattersSection from "./SiteWhatMattersSection";
import SiteFoundationsSection from "./SiteFoundationsSection";
import SiteObserveSection from "./SiteObserveSection";
import SiteDecisionsSection from "./SiteDecisionsSection";
import SiteOpportunitiesSection from "./SiteOpportunitiesSection";
import SiteResearchSection from "./SiteResearchSection";
import SiteActionsSection from "./SiteActionsSection";
import type { ObserveNotice } from "@/lib/gsc/config";
import styles from "./SitePageView.module.css";

type SitePageViewProps = {
  websiteId: string;
  observeNotice?: ObserveNotice | null;
};

export default function SitePageView({
  websiteId,
  observeNotice = null,
}: SitePageViewProps) {
  const { state, reload } = useWebsiteOverviewLoader(websiteId);
  const { scanAgain, isRescanning, rescanError } = useRescanNavigation(websiteId);
  const { snapshot: google, reload: reloadGooglePerformance } =
    useGooglePerformanceEvidence(websiteId);
  const {
    snapshot: indexing,
    checking: indexingBusy,
    check: checkGoogleIndexing,
    applyPilotEligibility,
  } = useGoogleIndexingEvidence(websiteId);
  const [indexingCheckAvailable, setIndexingCheckAvailable] = useState(false);
  const [decideRefreshKey, setDecideRefreshKey] = useState(0);

  const handleIndexingPilotEligibility = useCallback(
    (eligible: boolean) => {
      setIndexingCheckAvailable(eligible);
      applyPilotEligibility(eligible);
    },
    [applyPilotEligibility],
  );

  useEffect(() => {
    setIndexingCheckAvailable(false);
  }, [websiteId]);

  function refreshDecide() {
    setDecideRefreshKey((value) => value + 1);
  }

  async function refreshOverviewAndDecide() {
    await reload({ silent: true });
    refreshDecide();
  }

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

      <SiteWhatMattersSection
        overview={overview}
        latestScanHref={links.latestScanHref}
        google={selectGoogleEvidenceForWebsite(google, websiteId)}
        indexing={visibleGoogleIndexingForWebsite(indexing, websiteId).evidence}
      />

      <SiteFoundationsSection
        websiteId={websiteId}
        foundations={overview.latestUsableScan?.foundations ?? null}
        scanCompletedAt={overview.latestUsableScan?.completedAt ?? null}
        google={google}
        indexing={indexing}
        indexingBusy={indexingBusy}
        indexingCheckAvailable={indexingCheckAvailable}
        onCheckIndexing={checkGoogleIndexing}
      />

      {overview.siteModel ? (
        <SiteUnderstandingSection
          key={websiteId}
          websiteId={websiteId}
          siteModel={overview.siteModel}
          onUpdated={refreshOverviewAndDecide}
        />
      ) : null}

      {shouldShowWebsiteGoals(overview.siteModel) ? (
        <SiteGoalsSection
          websiteId={websiteId}
          goals={overview.goals}
          onUpdated={refreshOverviewAndDecide}
        />
      ) : null}

      <SiteObserveSection
        key={websiteId}
        websiteId={websiteId}
        notice={observeNotice}
        onUpdated={refreshDecide}
        performanceView={google.view}
        performanceEvidence={selectGoogleEvidenceForWebsite(google, websiteId)}
        performanceLoadError={google.loadError}
        onReloadPerformance={reloadGooglePerformance}
        onIndexingPilotEligibility={handleIndexingPilotEligibility}
      />

      <SiteDecisionsSection websiteId={websiteId} refreshKey={decideRefreshKey} />

      <SiteOpportunitiesSection websiteId={websiteId} refreshKey={decideRefreshKey} />

      <SiteResearchSection websiteId={websiteId} refreshKey={decideRefreshKey} />

      <SiteActionsSection websiteId={websiteId} refreshKey={decideRefreshKey} />

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
