import Link from "next/link";
import type { ReactNode } from "react";
import Footer from "./Footer";
import type { LandingCopy } from "@/lib/i18n/landing/types";
import styles from "./SimpleDocPage.module.css";

export default function SimpleDocPage({
  title,
  children,
  homeHref = "/",
  footerCopy,
  footerA11y,
}: {
  title: string;
  children?: ReactNode;
  homeHref?: string;
  footerCopy?: LandingCopy["footer"];
  footerA11y?: LandingCopy["a11y"];
}) {
  return (
    <>
      <main className={styles.page}>
        <div className={styles.inner}>
          <Link href={homeHref} className={styles.homeLink}>
            ← Foundfy
          </Link>
          <h1 className={styles.title}>{title}</h1>
          {children}
        </div>
      </main>
      <Footer copy={footerCopy} a11y={footerA11y} />
    </>
  );
}
