import type { Metadata } from "next";
import RootDocument from "@/components/layout/RootDocument";
import "../globals.css";

const siteTitle = "Foundfy | Be found wherever people search.";
const siteDescription =
  "Foundfy turns on-page SEO insights into clear actions. Built for a world where people search in more places.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.foundfy.me"),
  title: siteTitle,
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName: "Foundfy",
    locale: "en_US",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RootDocument lang="en" backToTopLabel="Back to top">
      {children}
    </RootDocument>
  );
}
