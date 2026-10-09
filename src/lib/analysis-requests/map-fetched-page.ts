import { pageComparisonKey } from "@/lib/gsc/page-map";

export type FetchedPageRef = {
  id: string;
  requestedUrl: string;
  finalUrl: string;
};

/**
 * Maps a requested URL onto a page Foundfy actually fetched.
 * Uses requested/final www-apex equivalence only. Does not use canonical.
 */
export function mapRequestedUrlToFetchedPage(
  requestedUrl: string,
  pages: FetchedPageRef[],
): FetchedPageRef | null {
  const requestedKey = pageComparisonKey(requestedUrl);
  if (!requestedKey) {
    return null;
  }

  return (
    pages.find((page) => {
      if (page.requestedUrl === requestedUrl || page.finalUrl === requestedUrl) {
        return true;
      }

      return (
        pageComparisonKey(page.requestedUrl) === requestedKey ||
        pageComparisonKey(page.finalUrl) === requestedKey
      );
    }) ?? null
  );
}
