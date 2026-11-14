import Reveal from "./Reveal";
import SectionFooter from "./SectionFooter";
import type { LandingCopy } from "@/lib/i18n/landing/types";
import styles from "./Closing.module.css";

export default function Closing({
  copy,
  a11y,
}: {
  copy: LandingCopy["closing"];
  a11y: LandingCopy["a11y"];
}) {
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
            {copy.headline.lead}
            <br />
            <span className={styles.accent}>{copy.headline.accent}</span>
            {copy.headline.tail ? (
              <>
                <br />
                {copy.headline.tail}
              </>
            ) : null}
          </h2>
        </Reveal>

        <Reveal delay={140}>
          <SectionFooter
            variant="dark"
            text={copy.footerText}
            logoHref={a11y.logoHref}
            logoLabel={a11y.logoLabel}
          />
        </Reveal>
      </div>
    </section>
  );
}
