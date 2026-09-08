import SectionFooter from "./SectionFooter";
import styles from "./Closing.module.css";

export default function Closing() {
  return (
    <section className={`section section-dark ${styles.closing}`}>
      <div className={styles.backgroundArtwork} aria-hidden="true">
        <div className={styles.backgroundImage} />
        <div className={styles.backgroundGrain} />
      </div>

      <div className={`section-inner ${styles.inner}`}>
        <div className={styles.content}>
          <h2 className={`heading-xl ${styles.headline}`}>
            Found today.
            <br />
            <span className="text-gradient">Further</span>
            <br />
            tomorrow.
          </h2>
        </div>

        <SectionFooter
          variant="dark"
          text="Be found wherever people search."
        />
      </div>
    </section>
  );
}
