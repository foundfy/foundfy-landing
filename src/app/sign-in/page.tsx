import type { Metadata } from "next";
import SimpleDocPage from "@/components/SimpleDocPage";

export const metadata: Metadata = {
  title: "Sign in | Foundfy",
  alternates: { canonical: "/sign-in" },
};

export default function SignInPage() {
  return <SimpleDocPage title="Sign in" />;
}