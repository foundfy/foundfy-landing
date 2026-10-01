import type { Metadata } from "next";

/**
 * Exact homepage meta description currently emitted by `src/app/layout.tsx`.
 * Restore this value as the ACT proposed_value, then delete the homepage
 * metadata override so `/` inherits it again.
 */
export const HOMEPAGE_META_DESCRIPTION_TO_RESTORE =
  "Foundfy turns on-page SEO insights into clear actions. Built for a world where people search in more places.";

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

/**
 * Temporary ACT v0 Slice 1 dogfood validation.
 *
 * `/` must render without `name=description` and `og:description`. Foundfy's
 * crawler treats `og:description` as a meta-description fallback, so omitting
 * only the basic description field would not produce a missing-meta Decision.
 * Next.js replaces `openGraph` wholesale, so this restates the existing OG
 * fields except description. Title, canonical, robots, and twitter stay on the
 * root layout. `/privacy` keeps its own description.
 */
export const homepageMetadata: Metadata = {
  description: null,
  openGraph: homepageOpenGraph,
};
