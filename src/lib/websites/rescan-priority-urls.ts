import { listObservations } from "@/lib/observations/db/repository";
import {
  extractFindingRecrawlUrls,
  selectFindingRecrawlUrls,
} from "@/lib/crawler/select/finding-recrawl-urls";
import { getOriginForHostname } from "@/lib/crawler/url/normalize";
import { findLatestUsableCrawlRun } from "./repository";
import type { WebsiteRecord } from "./types";

export async function resolveRescanPriorityUrls(
  website: WebsiteRecord,
  seedUrl: string,
): Promise<string[]> {
  try {
    const latestUsable = await findLatestUsableCrawlRun(website.id);
    if (!latestUsable) {
      return [];
    }

    const observations = await listObservations(latestUsable.id);
    return selectFindingRecrawlUrls(extractFindingRecrawlUrls(observations), {
      seedUrl,
      hostname: website.hostname,
      origin: getOriginForHostname(website.hostname),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load previous finding URLs for rescan.";
    console.error("[Website Scan] Failed to resolve rescan priority URLs:", message);
    return [];
  }
}
