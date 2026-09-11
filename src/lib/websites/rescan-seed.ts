import { getOriginForHostname } from "@/lib/crawler/url/normalize";
import type { WebsiteRecord } from "./types";
import { findLatestUsableCrawlRun } from "./repository";

export async function resolveRescanSeedUrl(
  website: WebsiteRecord,
): Promise<string> {
  const latestUsable = await findLatestUsableCrawlRun(website.id);

  if (latestUsable?.seedUrl) {
    return latestUsable.seedUrl;
  }

  if (website.displayUrl) {
    return website.displayUrl;
  }

  return getOriginForHostname(website.hostname);
}
