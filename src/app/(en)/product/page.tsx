import type { Metadata } from "next";
import SimpleDocPage from "@/components/SimpleDocPage";

export const metadata: Metadata = {
  title: "Product | Foundfy",
  alternates: { canonical: "/product" },
  // Placeholder page without content yet: keep it reachable but out of search results.
  robots: { index: false, follow: true },
};

export default function ProductPage() {
  return <SimpleDocPage title="Product" />;
}
