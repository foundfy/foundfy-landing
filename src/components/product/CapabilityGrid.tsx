import Reveal from "../Reveal";
import { CursorGlowSurface } from "../CursorGlow";
import styles from "./CapabilityGrid.module.css";

const pages = [
  { path: "/guides/getting-started", detail: "1,240 impressions · 86 clicks" },
  { path: "/pricing", detail: "640 impressions · 41 clicks" },
  { path: "/", detail: "210 impressions · 28 clicks" },
];

const technical = [
  { label: "Canonical", value: "/es/guide points elsewhere" },
  { label: "Metadata", value: "Missing meta description" },
  { label: "Indexability", value: "Page is in the crawl" },
  { label: "Internal links", value: "Thin path to this page" },
];

export default function CapabilityGrid() {
  return (
    <section className={styles.section} aria-labelledby="capability-heading">
      <div className={styles.grid}>
        <Reveal>
          <p className={styles.eyebrow}>
            04
            <br />
            Capabilities
          </p>
        </Reveal>

        <div className={styles.intro}>
          <Reveal>
            <h2 id="capability-heading" className={styles.heading}>
              Everything you need to move search forward.
            </h2>
          </Reveal>
          <Reveal className={styles.supporting} delay={80}>
            <p>
              The same signals Foundfy already uses: search evidence, site
              evidence, a decision, and a check that the change landed.
            </p>
          </Reveal>
        </div>

        <div className={styles.board}>
          <Reveal className={`${styles.cell} ${styles.visibility}`} data-cursor-glow-card>
            <CursorGlowSurface />
            <p className={styles.kicker}>Search visibility</p>
            <h3 className={styles.cellTitle}>
              Queries, landing pages, clicks, and impressions.
            </h3>
            <div className={styles.fragment}>
              <div className={styles.fragmentHead}>
                <span>Google Search</span>
                <span>Last 28 days</span>
              </div>
              <ul className={styles.pageList}>
                {pages.map((page) => (
                  <li key={page.path}>
                    <span className={styles.path}>{page.path}</span>
                    <span className={styles.meta}>{page.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal className={`${styles.cell} ${styles.content}`} delay={80} data-cursor-glow-card>
            <CursorGlowSurface />
            <p className={styles.kicker}>Content opportunities</p>
            <h3 className={styles.cellTitle}>
              Grounded in real search demand and intent.
            </h3>
            <div className={styles.fragment}>
              <p className={styles.query}>getting started guide</p>
              <dl className={styles.metaList}>
                <div>
                  <dt>Leading page</dt>
                  <dd>/guides/getting-started</dd>
                </div>
                <div>
                  <dt>Demand</dt>
                  <dd>1,240 appearances · 86 visits</dd>
                </div>
              </dl>
              <p className={styles.note}>Review this opportunity</p>
            </div>
          </Reveal>

          <Reveal className={`${styles.cell} ${styles.technical}`} delay={120} data-cursor-glow-card>
            <CursorGlowSurface />
            <p className={styles.kicker}>Technical actions</p>
            <h3 className={styles.cellTitle}>
              Canonicals, metadata, indexability, internal linking, crawl issues.
            </h3>
            <ul className={styles.issueList}>
              {technical.map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal className={`${styles.cell} ${styles.ai}`} delay={40} data-cursor-glow-card>
            <CursorGlowSurface />
            <p className={styles.kicker}>AI search</p>
            <h3 className={styles.cellTitle}>Visibility beyond traditional search.</h3>
            <div className={styles.ahead}>
              <span className={styles.aheadMark}>Ahead</span>
              <p>Building toward how this site shows up when people ask an assistant.</p>
            </div>
          </Reveal>

          <Reveal className={`${styles.cell} ${styles.execution}`} delay={100} data-cursor-glow-card>
            <CursorGlowSurface />
            <p className={styles.kicker}>Execution</p>
            <h3 className={styles.cellTitle}>Prepare, preview, approve, apply.</h3>
            <ol className={styles.actions}>
              <li>Prepare this change</li>
              <li className={styles.actionCurrent}>Approve</li>
              <li>Apply this change</li>
            </ol>
          </Reveal>

          <Reveal className={`${styles.cell} ${styles.verification}`} delay={140} data-cursor-glow-card>
            <CursorGlowSurface />
            <p className={styles.kicker}>Verification</p>
            <h3 className={styles.cellTitle}>
              Re-crawl and confirm that the change actually happened.
            </h3>
            <div className={styles.compare}>
              <div>
                <p>Expected</p>
                <p>Approved meta description</p>
              </div>
              <div>
                <p>Observed</p>
                <p>Same description on the fresh crawl</p>
              </div>
            </div>
            <p className={styles.match}>Verified · page matches</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
