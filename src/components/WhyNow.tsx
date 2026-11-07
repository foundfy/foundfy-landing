import {
  IconCircle,
  IconLines,
  IconTarget,
  IconPulse,
} from "./Icons";
import Reveal from "./Reveal";
import styles from "./WhyNow.module.css";

const statements = [
  "More platforms",
  "New behaviors",
  "Bigger opportunities",
];

const cardDelays = [0, 100, 160, 240];

const cards = [
  {
    icon: IconCircle,
    title: "SEO insights",
    description: "See what's working and what's not.",
  },
  {
    icon: IconLines,
    title: "Content opportunities",
    description: "Find new ideas that match real intent.",
  },
  {
    icon: IconTarget,
    title: "Technical checks",
    description: "Catch issues before they hold you back.",
  },
  {
    icon: IconPulse,
    title: "AI search, ahead",
    description: "We're building toward how brands show up in AI search.",
  },
];

export default function WhyNow() {
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
              Why now
            </p>
          </Reveal>

          <div className={styles.main}>
            <Reveal>
              <h2 className={styles.headline}>
                <span className={styles.headlineLine}>Search is changing.</span>
                <br />
                So are we.
              </h2>
            </Reveal>

            <Reveal className={styles.supporting} delay={100}>
              <p>
                People discover brands in more ways than ever. Foundfy is
                designed for this new era — starting with on-page SEO, and
                building toward AI search.
              </p>
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
