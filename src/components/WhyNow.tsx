import {
  IconCircle,
  IconLines,
  IconTarget,
  IconPulse,
} from "./Icons";
import Reveal from "./Reveal";
import type { LandingCopy } from "@/lib/i18n/landing/types";
import styles from "./WhyNow.module.css";

const cardDelays = [0, 100, 160, 240];

const cardIcons = [IconCircle, IconLines, IconTarget, IconPulse];

export default function WhyNow({ copy }: { copy: LandingCopy["whyNow"] }) {
  const statements = copy.statements;
  const cards = copy.cards.map((card, index) => ({ ...card, icon: cardIcons[index] }));

  return (
    <section className={styles.section}>
      <div className={styles.backgroundArtwork} aria-hidden="true">
        <div className={styles.backgroundImage} />
        <div className={styles.backgroundGlow} />
        <div className={styles.backgroundGrain} />
      </div>

      <div className={styles.content}>
        <div className={styles.grid}>
          <Reveal>
            <p className={styles.eyebrow}>
              02
              <br />
              {copy.eyebrow}
            </p>
          </Reveal>

          <div className={styles.main}>
            <Reveal>
              <h2 className={styles.headline}>
                <span className={styles.headlineLine}>{copy.headline[0]}</span>
                <br />
                {copy.headline[1]}
              </h2>
            </Reveal>

            <Reveal className={styles.supporting} delay={100}>
              <p>{copy.supporting}</p>
            </Reveal>
          </div>

          <div className={styles.cards}>
            {cards.map(({ icon: Icon, title, description }, index) => (
              <Reveal
                key={title}
                className={styles.card}
                delay={cardDelays[index]}
                data-cursor-glow-card
              >
                <span className="cursorGlowFill" aria-hidden="true" />
                <span className="cursorGlowEdge" aria-hidden="true" />
                <Icon size={24} className={styles.cardIcon} />
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardDesc}>{description}</p>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className={styles.bottom}>
              <div className={styles.statements}>
                {statements.map((label) => (
                  <div key={label} className={styles.statement}>
                    <span className={styles.statementLabel}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
