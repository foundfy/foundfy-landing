import {
  IconCircle,
  IconLines,
  IconTarget,
  IconPulse,
} from "./Icons";
import styles from "./WhyNow.module.css";

const statements = [
  "More platforms",
  "New behaviors",
  "Bigger opportunities",
];

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
    title: "AI visibility",
    description: "Understand how your brand appears in AI search.",
  },
];

export default function WhyNow() {
  return (
    <section className={styles.section}>
      <div className={styles.backgroundArtwork} aria-hidden="true">
        <div className={styles.backgroundImage} />
        <div className={styles.backgroundGrain} />
      </div>

      <div className={styles.content}>
        <div className={styles.grid}>
          <p className={styles.eyebrow}>
            02
            <br />
            Why now
          </p>

          <div className={styles.main}>
            <h2 className={styles.headline}>
              <span className={styles.headlineLine}>Search is changing.</span>
              <br />
              So are we.
            </h2>

            <div className={styles.supporting}>
              <p>
                People discover brands in more ways than ever. Foundfy is
                designed for this new era. Combining the fundamentals of SEO
                with the opportunities of AI search.
              </p>
            </div>
          </div>

          <div className={styles.cards}>
            {cards.map(({ icon: Icon, title, description }) => (
              <div key={title} className={styles.card}>
                <Icon size={24} className={styles.cardIcon} />
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardDesc}>{description}</p>
              </div>
            ))}
          </div>

          <div className={styles.bottom}>
            <div className={styles.statements}>
              {statements.map((label) => (
                <div key={label} className={styles.statement}>
                  <span className={styles.statementLabel}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
