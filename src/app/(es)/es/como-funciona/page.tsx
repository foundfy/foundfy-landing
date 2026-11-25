import type { Metadata } from "next";
import Link from "next/link";
import SimpleDocPage from "@/components/SimpleDocPage";
import simple from "@/components/SimpleDocPage.module.css";
import doc from "@/app/(en)/privacy/privacy.module.css";
import { ES_LANDING_COPY } from "@/lib/i18n/landing/es";
import { HOW_IT_WORKS_ES as copy } from "@/lib/how-it-works/content-es";
import styles from "./como-funciona.module.css";

// Spanish Experience PR 3. Inherits noindex from the (es) layout and stays out of
// the sitemap until the Spanish experience is published. The Open Graph fields
// are set so that a shared link previews this page instead of the Spanish home.
export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
  alternates: {
    canonical: copy.path,
  },
  openGraph: {
    title: copy.meta.title,
    description: copy.meta.description,
    url: copy.path,
    siteName: "Foundfy",
    locale: ES_LANDING_COPY.meta.ogLocale,
    type: "website",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: copy.meta.title }],
  },
  twitter: {
    card: "summary_large_image",
    title: copy.meta.title,
    description: copy.meta.description,
    images: ["/og-image.jpg"],
  },
};

export default function SpanishHowItWorksPage() {
  return (
    <SimpleDocPage
      title={copy.heading}
      homeHref="/es"
      footerCopy={ES_LANDING_COPY.footer}
      footerA11y={ES_LANDING_COPY.a11y}
    >
      <p className={doc.intro}>{copy.intro}</p>

      <section className={doc.section}>
        <h2 className={doc.sectionTitle}>{copy.service.title}</h2>
        <p className={doc.sectionBody}>{copy.service.body}</p>
      </section>

      <section className={doc.section}>
        <h2 className={doc.sectionTitle}>{copy.steps.title}</h2>
        <ol className={styles.steps}>
          {copy.steps.items.map((step) => (
            <li key={step.title} className={styles.step}>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={doc.sectionBody}>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={doc.section}>
        <h2 className={doc.sectionTitle}>{copy.responsibilities.title}</h2>
        <ul className={styles.roles}>
          {copy.responsibilities.items.map((item) => (
            <li key={item.who} className={doc.sectionBody}>
              <strong>{item.who}:</strong> {item.what}
            </li>
          ))}
        </ul>
      </section>

      {[copy.ai, copy.expectations].map((block) => (
        <section key={block.title} className={`${doc.section} ${styles.paragraphs}`}>
          <h2 className={doc.sectionTitle}>{block.title}</h2>
          {block.paragraphs.map((paragraph) => (
            <p key={paragraph} className={doc.sectionBody}>
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <section className={doc.section}>
        <h2 className={doc.sectionTitle}>{copy.free.title}</h2>
        <p className={doc.sectionBody}>{copy.free.body}</p>
      </section>

      <section className={`${doc.section} ${styles.cta}`}>
        <h2 className={doc.sectionTitle}>{copy.cta.title}</h2>
        <Link href={copy.cta.href} className={simple.actionLink}>
          {copy.cta.label}
        </Link>
      </section>
    </SimpleDocPage>
  );
}
