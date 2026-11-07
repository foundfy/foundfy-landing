import type { Metadata } from "next";
import SimpleDocPage from "@/components/SimpleDocPage";
import styles from "@/components/SimpleDocPage.module.css";

export const metadata: Metadata = {
  title: "Changelog | Foundfy",
  description: "Execute and verify approved changes.",
  alternates: {
    canonical: "/changelog",
  },
};

export default function ChangelogPage() {
  return (
    <SimpleDocPage title="Changelog">
      <article>
        <p className={styles.entryDate}>October 26, 2026</p>
        <h2 className={styles.entryTitle}>
          Execute and verify approved changes
        </h2>
      </article>
    </SimpleDocPage>
  );
}
