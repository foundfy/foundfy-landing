import type { Metadata } from "next";
import NotFoundView from "@/components/NotFoundView";
import RootDocument from "@/components/layout/RootDocument";
import { EN_LANDING_COPY } from "@/lib/i18n/landing/en";
import "./globals.css";

// Rendered for any URL that matches no route (experimental.globalNotFound).
// The app has two root layouts, so this page brings its own <html> document.
// Unknown URLs under /es are handled in Spanish by (es)/es/[...missing].
export const metadata: Metadata = {
  metadataBase: new URL("https://www.foundfy.me"),
  title: EN_LANDING_COPY.notFound.metaTitle,
};

export default function GlobalNotFound() {
  return (
    <RootDocument lang="en" backToTopLabel={EN_LANDING_COPY.a11y.backToTop}>
      <NotFoundView copy={EN_LANDING_COPY} />
    </RootDocument>
  );
}
