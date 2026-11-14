import type { Metadata } from "next";
import RootDocument from "@/components/layout/RootDocument";
import { ES_LANDING_COPY } from "@/lib/i18n/landing/es";
import "../globals.css";

const siteTitle = ES_LANDING_COPY.meta.title;
const siteDescription = ES_LANDING_COPY.meta.description;

// Spanish experience. Kept out of search results (noindex) until the whole
// Spanish experience is complete and approved; hreflang and the sitemap entry
// are added at that point, not before.
export const metadata: Metadata = {
  metadataBase: new URL("https://www.foundfy.me"),
  title: siteTitle,
  description: siteDescription,
  robots: { index: false, follow: true },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/es",
    siteName: "Foundfy",
    locale: ES_LANDING_COPY.meta.ogLocale,
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: siteTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og-image.jpg"],
  },
};

export default function SpanishRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RootDocument lang="es" backToTopLabel={ES_LANDING_COPY.a11y.backToTop}>
      {children}
    </RootDocument>
  );
}
