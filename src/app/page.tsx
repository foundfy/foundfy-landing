import type { Metadata } from "next";
import { AnalysisProvider } from "@/contexts/AnalysisContext";
import Hero from "@/components/Hero";
import WhatWeBuilding from "@/components/WhatWeBuilding";
import WhyNow from "@/components/WhyNow";
import EarlyAccess from "@/components/EarlyAccess";
import Closing from "@/components/Closing";
import Footer from "@/components/Footer";
import { HOMEPAGE_META_DESCRIPTION } from "@/lib/seo/homepage-description";

const homepageOpenGraph = {
  title: "Foundfy | Be found wherever people search.",
  url: "/",
  siteName: "Foundfy",
  locale: "en_US",
  type: "website" as const,
  images: [
    {
      url: "/og-image.jpg",
      width: 1200,
      height: 630,
      alt: "Foundfy | Be found wherever people search.",
    },
  ],
};

export const metadata: Metadata =
  HOMEPAGE_META_DESCRIPTION == null
    ? {
        description: null,
        openGraph: homepageOpenGraph,
      }
    : {
        description: HOMEPAGE_META_DESCRIPTION,
        openGraph: {
          ...homepageOpenGraph,
          description: HOMEPAGE_META_DESCRIPTION,
        },
      };

export default function Home() {
  return (
    <AnalysisProvider>
      <main>
        <Hero />
        <WhatWeBuilding />
        <WhyNow />
        <EarlyAccess />
        <Closing />
      </main>
      <Footer />
    </AnalysisProvider>
  );
}
