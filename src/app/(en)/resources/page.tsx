import type { Metadata } from "next";
import SimpleDocPage from "@/components/SimpleDocPage";

export const metadata: Metadata = {
  title: "Resources | Foundfy",
  alternates: { canonical: "/resources" },
  // Placeholder page without content yet: keep it reachable but out of search results.
  robots: { index: false, follow: true },
};

export default function ResourcesPage() {
  return <SimpleDocPage title="Resources" />;
}
