import type { Metadata } from "next";
import SimpleDocPage from "@/components/SimpleDocPage";

export const metadata: Metadata = {
  title: "Product | Foundfy",
  alternates: { canonical: "/product" },
};

export default function ProductPage() {
  return <SimpleDocPage title="Product" />;
}
