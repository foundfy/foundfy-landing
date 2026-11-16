import type { Metadata } from "next";
import SimpleDocPage from "@/components/SimpleDocPage";

export const metadata: Metadata = {
  title: "Resources | Foundfy",
  alternates: { canonical: "/resources" },
};

export default function ResourcesPage() {
  return <SimpleDocPage title="Resources" />;
}
