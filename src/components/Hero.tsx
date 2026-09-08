import Logo from "./Logo";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.bg} aria-hidden="true">
        <div className={styles.bgImage} />
        <div className={styles.bgOverlay} />
      </div>

      <div className={styles.grid}>
        <header className={styles.header}>
          <Logo variant="light" className={styles.logo} />
          <a href="#early-access" className={styles.headerCta}>
            Get early access →
          </a>
        </header>

        <div className={styles.main}>
          <div className={styles.content}>
            <h1 className={styles.headline}>
              Be found
              <br />
              wherever
              <br />
              <span className={styles.highlight}>people search.</span>
            </h1>

            <p className={styles.description}>
              A simpler way to improve your search visibility,
              <br className={styles.descriptionBreak} />
              across Google and the next generation of AI.
            </p>
          </div>
        </div>

        <div className={styles.bottom}>
          <p className={styles.bottomLeft}>
            Google
            <span className={styles.bottomDivider} aria-hidden="true">
              |
            </span>
            AI search
            <span className={styles.bottomDivider} aria-hidden="true">
              |
            </span>
            Your audience
            <span className={styles.bottomDivider} aria-hidden="true">
              |
            </span>
            New opportunities
          </p>

          <div className={styles.scroll}>
            <span>Scroll</span>
            <span className={styles.scrollLine} />
          </div>
        </div>
      </div>
    </section>
  );
}
