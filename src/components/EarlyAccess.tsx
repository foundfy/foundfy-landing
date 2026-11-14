import EarlyAccessContent from "./EarlyAccessContent";
import type { EarlyAccessFormCopy } from "@/lib/i18n/landing/types";
import styles from "./EarlyAccess.module.css";

export default function EarlyAccess({ copy }: { copy: EarlyAccessFormCopy }) {
  return (
    <section id="early-access" className={`section section-light ${styles.section}`}>
      <EarlyAccessContent copy={copy} />
    </section>
  );
}
