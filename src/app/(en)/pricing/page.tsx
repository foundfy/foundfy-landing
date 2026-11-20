import type { Metadata } from "next";
import SimpleDocPage from "@/components/SimpleDocPage";

export const metadata: Metadata = {
  title: "Pricing | Foundfy",
  alternates: { canonical: "/pricing" },
  // Placeholder page without content yet: keep it reachable but out of search results.
  robots: { index: false, follow: true },
};

export default function PricingPage() {
  return <SimpleDocPage title="Pricing" />;
}
