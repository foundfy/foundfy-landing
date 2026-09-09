import EarlyAccessContent from "./EarlyAccessContent";
import Reveal from "./Reveal";
import styles from "./EarlyAccess.module.css";

export default function EarlyAccess() {
  return (
    <section id="early-access" className={`section section-light ${styles.section}`}>
      <Reveal>
        <EarlyAccessContent />
      </Reveal>
    </section>
  );
}
