import Link from "next/link";
import type { ReactNode } from "react";
import Footer from "./Footer";
import styles from "./SimpleDocPage.module.css";

export default function SimpleDocPage({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <>
      <main className={styles.page}>
        <div className={styles.inner}>
          <Link href="/" className={styles.homeLink}>
            ← Foundfy
          </Link>
          <h1 className={styles.title}>{title}</h1>
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
