import type { Metadata } from "next";
import SimpleDocPage from "@/components/SimpleDocPage";

export const metadata: Metadata = {
  title: "Sign in | Foundfy",
  alternates: { canonical: "/sign-in" },
  // Placeholder page without content yet: keep it reachable but out of search results.
  robots: { index: false, follow: true },
};

export default function SignInPage() {
  return <SimpleDocPage title="Sign in" />;
}