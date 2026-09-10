"use client";

import { useState } from "react";
import { formatFindingPath } from "@/lib/analysis/finding-display";
import type { FixedFindingSnapshot } from "@/lib/analysis/crawl-status";
import styles from "./WebsiteAnalysisEntry.module.css";

type FixedFindingsSectionProps = {
  fixedFindings: FixedFindingSnapshot[];
};

export default function FixedFindingsSection({
  fixedFindings,
}: FixedFindingsSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (fixedFindings.length === 0) {
    return null;
  }

  return (
    <section className={styles.fixedFindingsSection} aria-labelledby="fixed-findings">
      <button
        type="button"
        id="fixed-findings"
        className={styles.fixedFindingsToggle}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        Fixed since last scan ({fixedFindings.length})
      </button>

      {expanded ? (
        <ul className={styles.fixedFindingsList}>
          {fixedFindings.map((finding, index) => {
            const pagePath = formatFindingPath(finding.pageUrl);
            const key = `${finding.ruleKey}-${finding.pageUrl ?? "site"}-${index}`;

            return (
              <li key={key} className={styles.fixedFindingItem}>
                <span className={styles.fixedFindingTitle}>{finding.title}</span>
                {pagePath ? (
                  <span className={styles.fixedFindingPath}>{pagePath}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
