import Logo from "./Logo";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <Logo variant="dark" />
        <a href="mailto:hello@foundfy.me" className={styles.email}>
          hello@foundfy.me
        </a>
      </div>
    </footer>
  );
}
