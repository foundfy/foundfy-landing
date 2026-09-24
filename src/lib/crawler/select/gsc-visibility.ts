import { hashSessionToken } from "@/lib/gsc/cookie";
import { findActiveObserveOwner, findActivePropertyConnection, findOwnerSessionByTokenHash } from "@/lib/gsc/db";
import { findLatestCompletedSearchSync, listEvidenceForSync } from "@/lib/gsc/db-search";
import { getOriginForHostname } from "../url/normalize";
import {
  GSC_INJECT_LIMIT,
  rankGscVisibilityPages,
  type GscVisibilityPage,
} from "./gsc-informed-selection";

export async function resolveOwnerGscVisibilityPages(input: {
  websiteId: string;
  hostname: string;
  sessionToken: string | null;
}): Promise<GscVisibilityPage[]> {
  if (!input.sessionToken) {
    return [];
  }

  try {
    const session = await findOwnerSessionByTokenHash(hashSessionToken(input.sessionToken));
    if (!session || session.websiteId !== input.websiteId) {
      return [];
    }

    const owner = await findActiveObserveOwner(input.websiteId);
    if (!owner || owner.googleIdentityId !== session.googleIdentityId) {
      return [];
    }

    const connection = await findActivePropertyConnection(input.websiteId);
    if (
      !connection ||
      connection.status !== "connected" ||
      connection.googleIdentityId !== owner.googleIdentityId
    ) {
      return [];
    }

    const sync = await findLatestCompletedSearchSync(input.websiteId, connection.id);
    if (!sync) {
      return [];
    }

    const evidence = await listEvidenceForSync(sync.id);
    const pages = rankGscVisibilityPages(
      evidence
        .filter((row) => row.evidenceType === "page" && row.pageUrl)
        .map((row) => ({
          url: row.pageUrl as string,
          impressions: row.impressions,
          clicks: row.clicks,
        })),
      {
        hostname: input.hostname,
        origin: getOriginForHostname(input.hostname),
      },
    );

    return pages.slice(0, GSC_INJECT_LIMIT);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load private Search Console crawl candidates.";
    console.error("[Crawl] GSC-informed selection unavailable:", message);
    return [];
  }
}
