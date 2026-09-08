import Logo from "./Logo";
import { ArrowRight } from "./Icons";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Logo variant="light" />
        <a href="#early-access" className="btn btn-outline">
          Get early access
          <ArrowRight />
        </a>
      </div>
    </header>
  );
}
