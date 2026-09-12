import type { MetadataRoute } from "next";
import { RESULT_ROBOTS_DISALLOW } from "@/lib/seo/result-indexing";

const siteUrl = "https://www.foundfy.me";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...RESULT_ROBOTS_DISALLOW],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
