import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import { ES_LANDING_COPY } from "@/lib/i18n/landing/es";
import {
  PRIVACY_INTRO_ES,
  PRIVACY_PAGE_TITLE_ES,
  PRIVACY_SECTIONS_ES,
} from "@/lib/privacy/content-es";
import styles from "@/app/(en)/privacy/privacy.module.css";

export const metadata: Metadata = {
  title: "Privacidad | Foundfy",
  description: PRIVACY_INTRO_ES,
  alternates: {
    canonical: "/es/privacidad",
  },
};

export default function SpanishPrivacyPage() {
  return (
    <>
      <main className={styles.page}>
        <div className={styles.inner}>
          <Link href="/es" className={styles.homeLink}>
            ← Foundfy
          </Link>
          <h1 className={styles.title}>{PRIVACY_PAGE_TITLE_ES}</h1>
          <p className={styles.intro}>{PRIVACY_INTRO_ES}</p>
          {PRIVACY_SECTIONS_ES.map((section) => (
            <section key={section.title} className={styles.section}>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
              <p className={styles.sectionBody}>{section.body}</p>
            </section>
          ))}
        </div>
      </main>
      <Footer copy={ES_LANDING_COPY.footer} a11y={ES_LANDING_COPY.a11y} />
    </>
  );
}
