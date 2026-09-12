import type { Metadata } from "next";

export const RESULT_ROBOTS_DISALLOW = ["/scan/", "/site/"] as const;

export const RESULT_PAGE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
};
