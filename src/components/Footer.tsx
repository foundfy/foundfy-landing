import Logo from "./Logo";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <Logo variant="dark" />
        <div className={styles.links}>
          <a href="/privacy" className={styles.privacy}>
            Privacy
          </a>
          <a href="mailto:hello@foundfy.me" className={styles.email}>
            hello@foundfy.me
          </a>
        </div>
      </div>
    </footer>
  );
}
