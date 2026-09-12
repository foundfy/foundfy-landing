import { buildResultsDisplayModel } from "@/lib/analysis/results-display-model";
import { buildSiteProgressContent } from "@/lib/site/site-overview-view-model";
import type { WebsiteOverview } from "@/lib/websites/types";
import styles from "./SitePageView.module.css";

type SiteProgressSectionProps = {
  latestUsableScan: NonNullable<WebsiteOverview["latestUsableScan"]>;
};

export default function SiteProgressSection({
  latestUsableScan,
}: SiteProgressSectionProps) {
  const jobCount = buildResultsDisplayModel(
    latestUsableScan.findings,
    latestUsableScan.findingsSummary,
  ).actionGroupCount;
  const progress = buildSiteProgressContent(latestUsableScan.comparison, jobCount);

  return (
    <section className={styles.section} aria-labelledby="site-progress">
      <h2 id="site-progress" className={styles.sectionHeading}>
        Since your last scan
      </h2>
      <p className={styles.progressNarrative}>{progress.copy}</p>
    </section>
  );
}
