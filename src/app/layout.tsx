import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import BackToTop from "@/components/BackToTop";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

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
    <html lang="en">
      <body className={`${inter.variable} ${inter.className}`}>
        <div className="grain" aria-hidden="true" />
        {/* SVG filter for gradient grain */}
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <filter id="grain-filter">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.8"
                numOctaves="4"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
              <feBlend in="SourceGraphic" mode="multiply" />
            </filter>
          </defs>
        </svg>
        {children}
        <BackToTop />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
