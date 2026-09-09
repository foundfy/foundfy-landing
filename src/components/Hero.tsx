import Logo from "./Logo";
import Reveal from "./Reveal";
import WebsiteAnalysisEntry from "./hero/WebsiteAnalysisEntry";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.bg} aria-hidden="true">
        <div className={styles.bgImage} />
        <div className={styles.bgGlowPrimary} />
        <div className={styles.bgGlowSecondary} />
        <div className={styles.bgOverlay} />
      </div>

      <div className={styles.grid}>
        <Reveal>
          <header className={styles.header}>
            <Logo variant="light" className={styles.logo} />
            <a href="#early-access" className={styles.headerCta}>
              Get early access →
            </a>
          </header>
        </Reveal>

        <Reveal className={styles.mainReveal} delay={80}>
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
                A simpler way to understand and improve your search visibility.
              </p>

              <WebsiteAnalysisEntry />
            </div>
          </div>
        </Reveal>

        <Reveal delay={160}>
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
        </Reveal>
      </div>
    </section>
  );
}
