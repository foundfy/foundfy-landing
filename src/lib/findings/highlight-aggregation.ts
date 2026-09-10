import type { AnalysisFinding } from "@/lib/analysis/crawl-status";
import { normalizeCrawlUrl } from "@/lib/crawler/url/normalize";

export function collectNormalizedAffectedSourceUrls(
  members: AnalysisFinding[],
): string[] {
  return [
    ...new Set(
      members
        .map((finding) => finding.pageUrl)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
        .map((url) => normalizeCrawlUrl(url))
        .filter((value): value is string => value !== null),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

export function computeBrokenLinkAffectedPageCount(
  members: AnalysisFinding[],
): number {
  const sourceUrls = collectNormalizedAffectedSourceUrls(members);
  return sourceUrls.length > 0 ? sourceUrls.length : 1;
}
