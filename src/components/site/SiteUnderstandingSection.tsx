"use client";

import { buildSiteUnderstandingView } from "@/lib/site-model/display";
import type { SiteModelRecord } from "@/lib/site-model/types";
import styles from "./SitePageView.module.css";

type SiteUnderstandingSectionProps = {
  siteModel: SiteModelRecord;
};

export default function SiteUnderstandingSection({
  siteModel,
}: SiteUnderstandingSectionProps) {
  const view = buildSiteUnderstandingView(siteModel);

  return (
    <section className={styles.section} aria-labelledby="site-understanding">
      <div className={styles.sectionIntro}>
        <h2 id="site-understanding" className={styles.sectionHeading}>
          {view.heading}
        </h2>
        <p className={styles.sectionMeta}>{view.statusLabel}</p>
        <p className={styles.sectionMeta}>{view.sampleCopy}</p>
        {view.coverageCopy ? (
          <p className={styles.sectionMeta}>{view.coverageCopy}</p>
        ) : null}
      </div>

      <div className={styles.understandingBlock}>
        <h3 className={styles.subsectionHeading}>URL types in this sample</h3>
        <p className={styles.understandingCopy}>{view.pageTypeSummary}</p>

        <h3 className={styles.subsectionHeading}>Fetched pages</h3>
        <ol className={styles.understandingPageList}>
          {view.pages.map((page) => (
            <li key={page.pageId} className={styles.understandingPageItem}>
              <p className={styles.understandingPageTitle}>
                {page.pathLabel}
                <span className={styles.understandingPageClass}>
                  {page.pathClassLabel}
                </span>
              </p>
              {page.title ? (
                <p className={styles.understandingCopy}>Title: {page.title}</p>
              ) : (
                <p className={styles.understandingCopy}>No title stored.</p>
              )}
              {page.h1.length > 0 ? (
                <p className={styles.understandingCopy}>H1: {page.h1.join(" · ")}</p>
              ) : null}
              {page.excerptPreview ? (
                <p className={styles.understandingExcerpt}>{page.excerptPreview}</p>
              ) : null}
            </li>
          ))}
        </ol>

        <h3 className={styles.subsectionHeading}>Languages observed</h3>
        <p className={styles.understandingCopy}>{view.languagesCopy}</p>

        <h3 className={styles.subsectionHeading}>Navigation labels</h3>
        <p className={styles.understandingCopy}>{view.navigationCopy}</p>

        <h3 className={styles.subsectionHeading}>Structured data stored</h3>
        <p className={styles.understandingCopy}>{view.structuredDataCopy}</p>

        <h3 className={styles.subsectionHeading}>robots.txt and sitemap</h3>
        <p className={styles.understandingCopy}>{view.discoveryCopy}</p>

        <p className={styles.understandingNote}>{view.confirmationNote}</p>
      </div>
    </section>
  );
}
