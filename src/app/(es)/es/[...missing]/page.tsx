import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ES_LANDING_COPY } from "@/lib/i18n/landing/es";

// Unknown URLs under /es get the Spanish 404 ((es)/not-found.tsx) with HTTP 404.
// This route must stay dynamic: with dynamicParams = false, Next serves the
// English global 404 instead.
export const metadata: Metadata = {
  title: ES_LANDING_COPY.notFound.metaTitle,
};

export default function SpanishMissingPage() {
  notFound();
}
