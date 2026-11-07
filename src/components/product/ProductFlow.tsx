import Reveal from "../Reveal";
import { CursorGlowSurface } from "../CursorGlow";
import styles from "./ProductFlow.module.css";

const evidenceRows = [
  { label: "Query", value: "getting started guide" },
  { label: "Page", value: "/guides/getting-started" },
  { label: "Impressions", value: "1,240" },
  { label: "Clicks", value: "86" },
  { label: "Match", value: "Exact page", accent: true },
  { label: "Crawl evidence", value: "Missing meta description" },
];

const decisionFields = [
  {
    label: "Why it matters",
    value:
      "This page already receives Google visibility and has no meta description.",
  },
  {
    label: "Website evidence",
    value: "Missing meta description on a crawled page.",
  },
  {
    label: "Goal context",
    value: "Prioritize pages that already show up before suggesting new content.",
  },
  {
    label: "Evidence period",
    value: "Last 28 days · 1,240 appearances · 86 visits",
  },
];

const lifecycle = ["Prepared", "Approved", "Executed", "Verified"];

export default function ProductFlow() {
  return (
    <section className={styles.section} aria-labelledby="product-flow-heading">
      <div className={styles.grid}>
        <Reveal>
          <p className={styles.eyebrow}>
            03
            <br />
            The loop
          </p>
        </Reveal>

        <div className={styles.intro}>
          <Reveal>
            <h2 id="product-flow-heading" className={styles.heading}>
              From signal to <span className={styles.accent}>verified</span> change.
            </h2>
          </Reveal>
          <Reveal className={styles.supporting} delay={100}>
            <p>
              Foundfy does not stop at findings. It connects evidence to a
              decision, helps execute the approved change, then verifies the
              result.
            </p>
          </Reveal>
        </div>

        <ol className={styles.steps}>
          <Reveal as="li" className={styles.step}>
            <div className={styles.stepCopy}>
              <p className={styles.stepIndex}>01</p>
              <h3 className={styles.stepTitle}>Observe</h3>
              <p className={styles.stepBody}>
                Foundfy combines crawl evidence, Google Search Console data,
                and what the site is trying to do.
              </p>
            </div>
            <div className={styles.panel} aria-label="Example search and crawl evidence" data-cursor-glow-card>
              <CursorGlowSurface />
              <div className={styles.panelHead}>
                <span>Google Search evidence</span>
                <span>Last 28 days</span>
              </div>
              <dl className={styles.rows}>
                {evidenceRows.map((row) => (
                  <div key={row.label} className={styles.row}>
                    <dt>{row.label}</dt>
                    <dd className={row.accent ? styles.accentValue : undefined}>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>

          <Reveal as="li" className={styles.step} delay={80}>
            <div className={styles.stepCopy}>
              <p className={styles.stepIndex}>02</p>
              <h3 className={styles.stepTitle}>Decide</h3>
              <p className={styles.stepBody}>
                Foundfy turns that evidence into one prioritized decision.
              </p>
            </div>
            <article className={styles.panel} aria-label="Example prioritized decision" data-cursor-glow-card>
              <CursorGlowSurface />
              <div className={styles.panelHead}>
                <span className={styles.chip}>Do first</span>
                <span>Why this?</span>
              </div>
              <h4 className={styles.panelTitle}>
                Add a meta description on /guides/getting-started
              </h4>
              <dl className={styles.rows}>
                {decisionFields.map((field) => (
                  <div key={field.label} className={styles.stackRow}>
                    <dt>{field.label}</dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </Reveal>

          <Reveal as="li" className={styles.step} delay={140}>
            <div className={styles.stepCopy}>
              <p className={styles.stepIndex}>03</p>
              <h3 className={styles.stepTitle}>Act and verify</h3>
              <p className={styles.stepBody}>
                The approved change moves from a preview to the page. Foundfy
                then re-checks that it is live.
              </p>
            </div>
            <div className={styles.panel} aria-label="Example action from preview to verification" data-cursor-glow-card>
              <CursorGlowSurface />
              <ol className={styles.lifecycle}>
                {lifecycle.map((stage, index) => (
                  <li
                    key={stage}
                    className={index === lifecycle.length - 1 ? styles.stageCurrent : styles.stage}
                  >
                    <span className={styles.stageMark} aria-hidden="true" />
                    {stage}
                  </li>
                ))}
              </ol>
              <div className={styles.preview}>
                <p className={styles.previewLabel}>Exact change · Update meta description</p>
                <p className={styles.previewPage}>/guides/getting-started</p>
                <div className={styles.previewPair}>
                  <div>
                    <p className={styles.pairLabel}>Current</p>
                    <p>None</p>
                  </div>
                  <div>
                    <p className={styles.pairLabel}>Proposed</p>
                    <p>
                      A practical guide for the search that already reaches this
                      page.
                    </p>
                  </div>
                </div>
              </div>
              <div className={styles.verified}>
                <p className={styles.verifiedLabel}>Verification</p>
                <p>
                  Verified. Foundfy re-checked the page and the meta description
                  matches the approved change.
                </p>
              </div>
            </div>
          </Reveal>
        </ol>
      </div>
    </section>
  );
}
