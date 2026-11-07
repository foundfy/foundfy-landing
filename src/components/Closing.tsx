import Reveal from "./Reveal";
import SectionFooter from "./SectionFooter";
import styles from "./Closing.module.css";

export default function Closing() {
  return (
    <section className={`section section-dark ${styles.closing}`}>
      <div className={styles.backgroundArtwork} aria-hidden="true">
        <div className={styles.backgroundImage} />
        <div className={styles.backgroundGlow} />
        <div className={styles.backgroundGrain} />
      </div>

      <div className={`section-inner ${styles.inner}`}>
        <Reveal className={styles.content}>
          <h2 className={`heading-xl ${styles.headline}`}>
            Found today.
            <br />
            <span className={styles.accent}>Further</span>
            <br />
            tomorrow.
          </h2>
        </Reveal>

        <Reveal delay={140}>
          <SectionFooter
            variant="dark"
            text="Be found wherever people search."
          />
        </Reveal>
      </div>
    </section>
  );
}
