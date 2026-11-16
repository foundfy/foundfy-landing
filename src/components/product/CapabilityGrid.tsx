import Reveal from "../Reveal";
import { CursorGlowSurface } from "../CursorGlow";
import type { LandingCopy } from "@/lib/i18n/landing/types";
import styles from "./CapabilityGrid.module.css";

export default function CapabilityGrid({
  copy,
}: {
  copy: LandingCopy["capabilityGrid"];
}) {
  const pages = copy.visibility.pages;
  const technical = copy.technical.items;

  return (
    <section
      id={copy.sectionId}
      className={styles.section}
      aria-labelledby="capability-heading"
    >
      <div className={styles.grid}>
        <Reveal>
          <p className={styles.eyebrow}>
            04
            <br />
            {copy.eyebrow}
          </p>
        </Reveal>

        <div className={styles.intro}>
          <Reveal>
            <h2 id="capability-heading" className={styles.heading}>
              {copy.heading}
            </h2>
          </Reveal>
          <Reveal className={styles.supporting} delay={80}>
            <p>{copy.supporting}</p>
            {copy.exampleNote ? (
              <p className={styles.exampleNote}>{copy.exampleNote}</p>
            ) : null}
          </Reveal>
        </div>

        <div className={styles.board}>
          <Reveal className={`${styles.cell} ${styles.visibility}`} data-cursor-glow-card>
            <CursorGlowSurface />
            <p className={styles.kicker}>{copy.visibility.kicker}</p>
            <h3 className={styles.cellTitle}>{copy.visibility.title}</h3>
            <div className={styles.fragment}>
              <div className={styles.fragmentHead}>
                <span>{copy.visibility.head[0]}</span>
                <span>{copy.visibility.head[1]}</span>
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
            <p className={styles.kicker}>{copy.content.kicker}</p>
            <h3 className={styles.cellTitle}>{copy.content.title}</h3>
            <div className={styles.fragment}>
              <p className={styles.query}>{copy.content.query}</p>
              <dl className={styles.metaList}>
                <div>
                  <dt>{copy.content.leadingPage.label}</dt>
                  <dd>{copy.content.leadingPage.value}</dd>
                </div>
                <div>
                  <dt>{copy.content.demand.label}</dt>
                  <dd>{copy.content.demand.value}</dd>
                </div>
              </dl>
              <p className={styles.note}>{copy.content.note}</p>
            </div>
          </Reveal>

          <Reveal className={`${styles.cell} ${styles.technical}`} delay={120} data-cursor-glow-card>
            <CursorGlowSurface />
            <p className={styles.kicker}>{copy.technical.kicker}</p>
            <h3 className={styles.cellTitle}>{copy.technical.title}</h3>
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
            <p className={styles.kicker}>{copy.ai.kicker}</p>
            <h3 className={styles.cellTitle}>{copy.ai.title}</h3>
            <div className={styles.ahead}>
              <span className={styles.aheadMark}>{copy.ai.ahead}</span>
              <p>{copy.ai.text}</p>
            </div>
          </Reveal>

          <Reveal className={`${styles.cell} ${styles.execution}`} delay={100} data-cursor-glow-card>
            <CursorGlowSurface />
            <p className={styles.kicker}>{copy.execution.kicker}</p>
            <h3 className={styles.cellTitle}>{copy.execution.title}</h3>
            <ol className={styles.actions}>
              <li>{copy.execution.actions[0]}</li>
              <li className={styles.actionCurrent}>{copy.execution.actions[1]}</li>
              <li>{copy.execution.actions[2]}</li>
            </ol>
          </Reveal>

          <Reveal className={`${styles.cell} ${styles.verification}`} delay={140} data-cursor-glow-card>
            <CursorGlowSurface />
            <p className={styles.kicker}>{copy.verification.kicker}</p>
            <h3 className={styles.cellTitle}>{copy.verification.title}</h3>
            <div className={styles.compare}>
              <div>
                <p>{copy.verification.expected.label}</p>
                <p>{copy.verification.expected.value}</p>
              </div>
              <div>
                <p>{copy.verification.observed.label}</p>
                <p>{copy.verification.observed.value}</p>
              </div>
            </div>
            <p className={styles.match}>{copy.verification.match}</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
