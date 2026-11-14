import type { ReactNode } from "react";
import { Instrument_Serif, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import BackToTop from "@/components/BackToTop";
import type { Locale } from "@/lib/i18n/locales";

const inter = Inter({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: "italic",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

// Shared <html> document for each language's root layout. Each route group
// ((en), (es)) has its own root layout so every page declares its real language.
export default function RootDocument({
  lang,
  backToTopLabel,
  children,
}: {
  lang: Locale;
  backToTopLabel: string;
  children: ReactNode;
}) {
  return (
    <html lang={lang}>
      <head>
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=general-sans@500&display=swap"
        />
      </head>
      <body className={`${inter.variable} ${instrumentSerif.variable} ${inter.className}`}>
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
        <BackToTop label={backToTopLabel} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
