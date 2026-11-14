import type { Metadata } from "next";
import LandingPage from "@/components/LandingPage";
import { EN_LANDING_COPY } from "@/lib/i18n/landing/en";
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
  return <LandingPage copy={EN_LANDING_COPY} />;
}
