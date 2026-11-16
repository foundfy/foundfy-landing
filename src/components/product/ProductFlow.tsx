import Reveal from "../Reveal";
import { CursorGlowSurface } from "../CursorGlow";
import type { LandingCopy } from "@/lib/i18n/landing/types";
import styles from "./ProductFlow.module.css";

export default function ProductFlow({ copy }: { copy: LandingCopy["productFlow"] }) {
  const evidenceRows = copy.observe.rows;
  const decisionFields = copy.decide.fields;
  const lifecycle = copy.act.lifecycle;

  return (
    <section
      id={copy.sectionId}
      className={styles.section}
      aria-labelledby="product-flow-heading"
    >
      <div className={styles.grid}>
        <Reveal>
          <p className={styles.eyebrow}>
            03
            <br />
            {copy.eyebrow}
          </p>
        </Reveal>

        <div className={styles.intro}>
          <Reveal>
            <h2 id="product-flow-heading" className={styles.heading}>
              {copy.heading.before}
              <span className={styles.accent}>{copy.heading.accent}</span>
              {copy.heading.after}
            </h2>
          </Reveal>
          <Reveal className={styles.supporting} delay={100}>
            <p>{copy.supporting}</p>
            {copy.exampleNote ? (
              <p className={styles.exampleNote}>{copy.exampleNote}</p>
            ) : null}
          </Reveal>
        </div>

        <ol className={styles.steps}>
          <Reveal as="li" className={styles.step}>
            <div className={styles.stepCopy}>
              <p className={styles.stepIndex}>01</p>
              <h3 className={styles.stepTitle}>{copy.observe.title}</h3>
              <p className={styles.stepBody}>{copy.observe.body}</p>
            </div>
            <div className={styles.panel} aria-label={copy.observe.panelLabel} data-cursor-glow-card>
              <CursorGlowSurface />
              <div className={styles.panelHead}>
                <span>{copy.observe.panelHead[0]}</span>
                <span>{copy.observe.panelHead[1]}</span>
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
              <h3 className={styles.stepTitle}>{copy.decide.title}</h3>
              <p className={styles.stepBody}>{copy.decide.body}</p>
            </div>
            <article className={styles.panel} aria-label={copy.decide.panelLabel} data-cursor-glow-card>
              <CursorGlowSurface />
              <div className={styles.panelHead}>
                <span className={styles.chip}>{copy.decide.chip}</span>
                <span>{copy.decide.why}</span>
              </div>
              <h4 className={styles.panelTitle}>{copy.decide.panelTitle}</h4>
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
              <h3 className={styles.stepTitle}>{copy.act.title}</h3>
              <p className={styles.stepBody}>{copy.act.body}</p>
            </div>
            <div className={styles.panel} aria-label={copy.act.panelLabel} data-cursor-glow-card>
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
                <p className={styles.previewLabel}>{copy.act.previewLabel}</p>
                <p className={styles.previewPage}>{copy.act.previewPage}</p>
                <div className={styles.previewPair}>
                  <div>
                    <p className={styles.pairLabel}>{copy.act.current.label}</p>
                    <p>{copy.act.current.value}</p>
                  </div>
                  <div>
                    <p className={styles.pairLabel}>{copy.act.proposed.label}</p>
                    <p>{copy.act.proposed.value}</p>
                  </div>
                </div>
              </div>
              <div className={styles.verified}>
                <p className={styles.verifiedLabel}>{copy.act.verification.label}</p>
                <p>{copy.act.verification.value}</p>
              </div>
            </div>
          </Reveal>
        </ol>
      </div>
    </section>
  );
}
