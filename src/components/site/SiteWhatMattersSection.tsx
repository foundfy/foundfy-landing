import Link from "next/link";
import FindingCard from "@/components/hero/FindingCard";
import { getSiteScanLinkLabel } from "@/lib/analysis/landing-persistent-bridge";
import type { GooglePerformanceEvidenceInput } from "@/lib/foundations/types";
import { buildFirstValueView } from "@/lib/site/first-value";
import type { WebsiteOverview } from "@/lib/websites/types";
import styles from "./SitePageView.module.css";

type SiteWhatMattersSectionProps = {
  overview: WebsiteOverview;
  latestScanHref: string | null;
  google: GooglePerformanceEvidenceInput | null;
};

export default function SiteWhatMattersSection({
  overview,
  latestScanHref,
  google,
}: SiteWhatMattersSectionProps) {
  const view = buildFirstValueView(overview, google);

  return (
    <section className={styles.section} aria-labelledby="site-first-value">
      <div className={styles.sectionIntro}>
        <h2 id="site-first-value" className={styles.sectionHeading}>
          {view.heading}
        </h2>
      </div>

      <div className={styles.firstValueStack}>
        <div className={styles.firstValueBlock}>
          <h3 className={styles.subsectionHeading}>{view.completedHeading}</h3>
          <p className={styles.emptyStateCopy}>{view.completedBody}</p>
        </div>

        {view.attentionCards.length > 0 ? (
          <div className={styles.firstValueBlock}>
            <h3 className={styles.subsectionHeading}>{view.attentionHeading}</h3>
            <div className={styles.highlightList}>
              {view.attentionCards.map((card) => (
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
          </div>
        ) : null}

        {view.notes.length > 0 ? (
          <div className={styles.firstValueBlock}>
            <h3 className={styles.subsectionHeading}>{view.notesHeading}</h3>
            <ul className={styles.firstValueNoteList}>
              {view.notes.map((note) => (
                <li key={note.key}>
                  <p className={styles.foundationsSummary}>{note.explanation}</p>
                  {note.pageLabels.length > 0 ? (
                    <p className={styles.firstValueUrls}>{note.pageLabels.join(" · ")}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={styles.firstValueBlock}>
          <h3 className={styles.subsectionHeading}>{view.unknownHeading}</h3>
          <p className={styles.emptyStateCopy}>{view.unknownBody}</p>
        </div>

        <div className={styles.firstValueBlock}>
          <h3 className={styles.subsectionHeading}>{view.nextHeading}</h3>
          <p className={styles.foundationsSummary}>{view.nextStep.message}</p>
        </div>

        <div className={styles.firstValueBlock}>
          <h3 className={styles.subsectionHeading}>{view.ownerHeading}</h3>
          <p className={styles.foundationsSummary}>{view.ownerNeed.message}</p>
          {view.googleSyncClarification ? (
            <p className={styles.foundationsDetail}>{view.googleSyncClarification}</p>
          ) : null}
        </div>

        {latestScanHref && view.latestScanHrefLabel ? (
          <Link href={latestScanHref} className={styles.fullAnalysisLink}>
            {getSiteScanLinkLabel()}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
