import type { Metadata } from "next";
import LandingPage from "@/components/LandingPage";
import { ES_LANDING_COPY } from "@/lib/i18n/landing/es";

export const metadata: Metadata = {
  alternates: {
    canonical: "/es",
  },
};

export default function SpanishHome() {
  return <LandingPage copy={ES_LANDING_COPY} />;
}
