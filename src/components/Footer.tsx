import Logo from "./Logo";
import type { LandingCopy } from "@/lib/i18n/landing/types";
import { EN_LANDING_COPY } from "@/lib/i18n/landing/en";
import styles from "./Footer.module.css";

export default function Footer({
  copy = EN_LANDING_COPY.footer,
  a11y = EN_LANDING_COPY.a11y,
}: {
  copy?: LandingCopy["footer"];
  a11y?: LandingCopy["a11y"];
}) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <Logo variant="dark" href={a11y.logoHref} label={a11y.logoLabel} />
        <div className={styles.links}>
          <a href={copy.privacy.href} className={styles.privacy}>
            {copy.privacy.label}
          </a>
          <a href="mailto:hello@foundfy.me" className={styles.email}>
            hello@foundfy.me
          </a>
        </div>
      </div>
    </footer>
  );
}
