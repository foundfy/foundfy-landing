import type { Metadata } from "next";
import { RESULT_PAGE_ROBOTS } from "@/lib/seo/result-indexing";

export const metadata: Metadata = {
  robots: RESULT_PAGE_ROBOTS,
};

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
