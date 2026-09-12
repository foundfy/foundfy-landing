import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import {
  PRIVACY_INTRO,
  PRIVACY_PAGE_TITLE,
  PRIVACY_SECTIONS,
} from "@/lib/privacy/content";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Privacy | Foundfy",
  description: PRIVACY_INTRO,
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <main className={styles.page}>
        <div className={styles.inner}>
          <Link href="/" className={styles.homeLink}>
            ← Foundfy
          </Link>
          <h1 className={styles.title}>{PRIVACY_PAGE_TITLE}</h1>
          <p className={styles.intro}>{PRIVACY_INTRO}</p>
          {PRIVACY_SECTIONS.map((section) => (
            <section key={section.title} className={styles.section}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              <p className={styles.sectionBody}>{section.body}</p>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
