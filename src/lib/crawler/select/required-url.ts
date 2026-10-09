import { hostVariantPairKey } from "./host-variant-equivalence";
import { classifyPagePath } from "./page-priority";
import {
  isSameSite,
  validatePublicHttpUrl,
} from "../url/normalize";

export const MAX_REQUIRED_URLS = 1;
export const REQUIRED_QUEUE_PRIORITY = 98;
export const REQUIRED_URL_NOT_IN_ACTIVE_RUN = "required_url_not_in_active_run" as const;

export class InvalidRequiredCrawlUrlError extends Error {
  readonly code = "invalid_required_url" as const;

  constructor(message = "Required crawl URL is not safe to fetch for this website.") {
    super(message);
    this.name = "InvalidRequiredCrawlUrlError";
  }
}

export function isRequiredQueuePriority(priority: number): boolean {
  return priority === REQUIRED_QUEUE_PRIORITY;
}

export function resolveRequiredCrawlUrl(input: {
  requiredUrl: string | null | undefined;
  seedUrl: string;
  hostname?: string;
}): string | null {
  const raw = input.requiredUrl?.trim();
  if (!raw) {
    return null;
  }

  const validated = validatePublicHttpUrl(raw);
  if (!validated) {
    return null;
  }

  let hostname = input.hostname;
  if (!hostname) {
    try {
      hostname = new URL(input.seedUrl).hostname;
    } catch {
      return null;
    }
  }

  if (!isSameSite(validated.url, hostname)) {
    return null;
  }

  if (classifyPagePath(validated.url) === "utility") {
    return null;
  }

  return validated.url;
}

export function requiredUrlMatchesQueuedUrl(
  requiredUrl: string,
  queuedUrl: string,
  origin?: string,
): boolean {
  const requiredKey = hostVariantPairKey(requiredUrl, origin);
  const queuedKey = hostVariantPairKey(queuedUrl, origin);
  return Boolean(requiredKey && queuedKey && requiredKey === queuedKey);
}

export type ActiveCrawlRequiredUrlResult =
  | { action: "reuse"; crawlRunId: string }
  | { action: "start" }
  | { action: "unavailable"; reason: typeof REQUIRED_URL_NOT_IN_ACTIVE_RUN };

export function resolveActiveCrawlForRequiredUrl(input: {
  activeRunId: string | null;
  requiredUrl?: string | null;
  seedUrl: string;
  hostname?: string;
  origin?: string;
  queueItems: Array<{ url: string }>;
}): ActiveCrawlRequiredUrlResult {
  if (!input.activeRunId) {
    return { action: "start" };
  }

  const requiredUrl = resolveRequiredCrawlUrl({
    requiredUrl: input.requiredUrl,
    seedUrl: input.seedUrl,
    hostname: input.hostname,
  });

  if (!requiredUrl) {
    return { action: "reuse", crawlRunId: input.activeRunId };
  }

  const included = input.queueItems.some((item) =>
    requiredUrlMatchesQueuedUrl(requiredUrl, item.url, input.origin),
  );

  if (included) {
    return { action: "reuse", crawlRunId: input.activeRunId };
  }

  return { action: "unavailable", reason: REQUIRED_URL_NOT_IN_ACTIVE_RUN };
}
