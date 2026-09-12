"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { EMPTY_FINDINGS_SUMMARY } from "@/contexts/AnalysisContext";
import { useCrawlStatusLoader } from "@/hooks/useCrawlStatusLoader";
import { getScanResultsResetLabel } from "@/lib/analysis/landing-persistent-bridge";
import { shouldShowScanResults } from "@/lib/scan/scan-results-display";
import AnalysisResultsView from "@/components/hero/AnalysisResultsView";
import { AnalysisAnalyzingViewInner } from "@/components/hero/AnalysisAnalyzingView";
import heroStyles from "@/components/hero/WebsiteAnalysisEntry.module.css";
import shellStyles from "@/components/persistent/PersistentPageShell.module.css";

type ScanPageViewProps = {
  crawlRunId: string;
};

function buildFindingsSummary(
  payload: NonNullable<ReturnType<typeof useCrawlStatusLoader>["payload"]>,
) {
  const findings = payload.findings ?? [];

  return (
    payload.findingsSummary ?? {
      ...EMPTY_FINDINGS_SUMMARY,
      totalCount: findings.length,
    }
  );
}

export default function ScanPageView({ crawlRunId }: ScanPageViewProps) {
  const router = useRouter();
  const { phase, payload, errorMessage, loadedAsCompleted } = useCrawlStatusLoader(
    crawlRunId,
  );
  const [showResults, setShowResults] = useState(false);

  const websiteId = payload?.websiteId ?? null;
  const hostname = payload?.hostname ?? "this site";
  const siteHref = websiteId ? `/site/${websiteId}` : null;

  const handleReset = () => {
    router.push(siteHref ?? "/");
  };

  const handleResultsReady = useCallback(() => {
    setShowResults(true);
  }, []);

  const nav =
    websiteId && hostname ? (
      <nav className={shellStyles.nav} aria-label="Site navigation">
        <Link href={`/site/${websiteId}`} className={shellStyles.backLink}>
          ← All scans for {hostname}
        </Link>
      </nav>
    ) : null;

  if (phase === "loading") {
    return (
      <>
        {nav}
        <p className={shellStyles.loading}>Loading scan…</p>
      </>
    );
  }

  if (phase === "not_found") {
    return (
      <>
        {nav}
        <p className={shellStyles.errorMessage} role="alert">
          {errorMessage ?? "Scan not found."}
        </p>
      </>
    );
  }

  if (phase === "error") {
    return (
      <>
        {nav}
        <p className={shellStyles.errorMessage} role="alert">
          {errorMessage ?? "Unable to load this scan right now."}
        </p>
      </>
    );
  }

  if (!payload) {
    return null;
  }

  if (phase === "failed") {
    return (
      <div>
        {nav}
        <p className={shellStyles.errorMessage} role="alert">
          {errorMessage ?? payload.errorMessage ?? "Crawl failed."}
        </p>
        <button
          type="button"
          className={heroStyles.resetButton}
          onClick={handleReset}
        >
          {siteHref ? "Back to site" : "Back to home"}
        </button>
      </div>
    );
  }

  const shouldShowResults = shouldShowScanResults({
    phase,
    loadedAsCompleted,
    showResults,
  });

  if (shouldShowResults) {
    const findings = payload.findings ?? [];

    return (
      <>
        {nav}
        <div className={`${heroStyles.wrapper} ${heroStyles.wrapperResults}`.trim()}>
        <AnalysisResultsView
          hostname={hostname}
          findings={findings}
          findingsSummary={buildFindingsSummary(payload)}
          comparison={payload.comparison ?? null}
          searchPresence={payload.searchPresence ?? null}
          websiteId={websiteId}
          pagesCrawled={payload.pagesCrawled}
          surface="scan"
          onReset={handleReset}
          resetLabel={getScanResultsResetLabel(Boolean(siteHref))}
        />
        </div>
      </>
    );
  }

  if (phase === "analyzing" || phase === "completed") {
    return (
      <>
        {nav}
        <div className={heroStyles.wrapper}>
        <AnalysisAnalyzingViewInner
          hostname={hostname}
          crawlStatus={payload.status}
          pagesCrawled={payload.pagesCrawled}
          maxPages={payload.maxPages}
          findings={payload.findings ?? []}
          findingsSummary={payload.findingsSummary ?? null}
          comparison={payload.comparison ?? null}
          onResultsReady={handleResultsReady}
          onReset={handleReset}
          resetLabel={getScanResultsResetLabel(Boolean(siteHref))}
        />
        </div>
      </>
    );
  }

  return null;
}
