import Link from "next/link";
import FindingCard from "@/components/hero/FindingCard";
import { getSiteScanLinkLabel } from "@/lib/analysis/landing-persistent-bridge";
import {
  buildSiteResultsDisplayModel,
  buildSiteWhatMattersContent,
  formatSiteMetadataLine,
} from "@/lib/site/site-overview-view-model";
import type { WebsiteOverview } from "@/lib/websites/types";
import styles from "./SitePageView.module.css";

type SiteWhatMattersSectionProps = {
  overview: WebsiteOverview;
  latestScanHref: string | null;
};

export default function SiteWhatMattersSection({
  overview,
  latestScanHref,
}: SiteWhatMattersSectionProps) {
  const content = buildSiteWhatMattersContent(overview);
  const latest = overview.latestUsableScan;
  const model = buildSiteResultsDisplayModel(overview);

  if (content.kind === "no_scan") {
    return (
      <section className={styles.section} aria-labelledby="site-current-state">
        <h2 id="site-current-state" className={styles.sectionHeading}>
          Current state
        </h2>
        <div className={styles.emptyStateBlock}>
          <p className={styles.emptyStateTitle}>{content.title}</p>
          <p className={styles.emptyStateCopy}>{content.description}</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="site-current-state">
      <div className={styles.sectionIntro}>
        <h2 id="site-current-state" className={styles.sectionHeading}>
          Current state
        </h2>
        {latest ? (
          <p className={styles.sectionMeta}>
            {formatSiteMetadataLine({
              pagesCrawled: latest.pagesCrawled,
              jobCount: model?.actionGroupCount ?? 0,
              completedAt: latest.completedAt,
            })}
          </p>
        ) : null}
      </div>

      <div className={styles.whatMattersBlock}>
        <h3 className={styles.subsectionHeading}>What matters now</h3>

        {content.kind === "highlights" && model ? (
          <div className={styles.highlightList}>
            {model.highlightCards.map((card) => (
              <FindingCard
                key={card.key}
                finding={card.finding}
                variant="highlight"
                title={card.title}
                sharedTitleLine={card.sharedTitleLine}
                affectedUrls={card.affectedUrls}
                affectedPages={card.affectedPages}
              />
            ))}
          </div>
        ) : content.kind !== "highlights" ? (
          <div className={styles.emptyHighlightsBlock}>
            <p className={styles.emptyStateTitle}>{content.title}</p>
            <p className={styles.emptyStateCopy}>{content.description}</p>
          </div>
        ) : null}

        {latestScanHref ? (
          <Link href={latestScanHref} className={styles.fullAnalysisLink}>
            {getSiteScanLinkLabel()}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
