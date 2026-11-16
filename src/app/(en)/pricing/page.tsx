import type { Metadata } from "next";
import SimpleDocPage from "@/components/SimpleDocPage";

export const metadata: Metadata = {
  title: "Pricing | Foundfy",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return <SimpleDocPage title="Pricing" />;
}
