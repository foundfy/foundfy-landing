import EarlyAccessContent from "./EarlyAccessContent";
import styles from "./EarlyAccess.module.css";

export default function EarlyAccess() {
  return (
    <section id="early-access" className={`section section-light ${styles.section}`}>
      <EarlyAccessContent />
    </section>
  );
}
