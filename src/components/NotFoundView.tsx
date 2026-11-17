import Link from "next/link";
import SimpleDocPage from "@/components/SimpleDocPage";
import styles from "@/components/SimpleDocPage.module.css";
import type { LandingCopy } from "@/lib/i18n/landing/types";

// 404 content in the style of the site's simple pages, for both languages.
export default function NotFoundView({ copy }: { copy: LandingCopy }) {
  return (
    <SimpleDocPage
      title={copy.notFound.heading}
      homeHref={copy.a11y.logoHref}
      footerCopy={copy.footer}
      footerA11y={copy.a11y}
    >
      <p className={styles.lead}>{copy.notFound.body}</p>
      <Link href={copy.notFound.homeLink.href} className={styles.actionLink}>
        {copy.notFound.homeLink.label}
      </Link>
    </SimpleDocPage>
  );
}
