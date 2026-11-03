import { isValidUuid } from "@/lib/websites/uuid";
import { GoogleIndexingPilotError } from "./types";

/**
 * Fail-closed Google Indexing Observation v0 pilot allowlist.
 *
 * Format: comma-separated `websiteId:googleIdentityId` UUID pairs.
 * Example: `a0dc3fb3-e14a-4277-9bd5-6fe4e0a6e0b2:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`
 *
 * Activation (production):
 * 1. In the Vercel project, set `GOOGLE_INDEXING_PILOT_ALLOWLIST` on the
 *    Production environment to the authorized websiteId:googleIdentityId pairs.
 * 2. Redeploy Production so every serverless instance receives the value.
 *    Editing the env var without a new deployment does not update running
 *    instances.
 *
 * Deactivation:
 * 1. Remove `GOOGLE_INDEXING_PILOT_ALLOWLIST` or set it to an empty string.
 * 2. Redeploy Production. A missing, empty, or malformed value denies every
 *    inspection and sitemap read.
 *
 * This allowlist is not a quota. Process-local 15-minute reuse remains
 * process-local and is not a globally enforced rate limit.
 */
export const GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV = "GOOGLE_INDEXING_PILOT_ALLOWLIST";
export const GOOGLE_INDEXING_PILOT_INELIGIBLE_CODE = "pilot_ineligible" as const;
export const GOOGLE_INDEXING_PILOT_INELIGIBLE_ERROR =
  "Google indexing observation is not available for this site yet.";

export type GoogleIndexingPilotParse =
  | { ok: true; size: number }
  | { ok: false; reason: "missing" | "empty" | "malformed" };

function pairKey(websiteId: string, googleIdentityId: string): string {
  return `${websiteId.toLowerCase()}:${googleIdentityId.toLowerCase()}`;
}

function parseAllowlistPairs(raw: string | undefined):
  | { ok: true; pairs: ReadonlySet<string> }
  | { ok: false; reason: "missing" | "empty" | "malformed" } {
  if (raw == null) {
    return { ok: false, reason: "missing" };
  }

  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, reason: "empty" };
  }

  const pairs = new Set<string>();
  for (const part of trimmed.split(",")) {
    const token = part.trim();
    if (!token) {
      return { ok: false, reason: "malformed" };
    }

    const segments = token.split(":");
    if (segments.length !== 2) {
      return { ok: false, reason: "malformed" };
    }

    const websiteId = segments[0]?.trim() ?? "";
    const googleIdentityId = segments[1]?.trim() ?? "";
    if (!isValidUuid(websiteId) || !isValidUuid(googleIdentityId)) {
      return { ok: false, reason: "malformed" };
    }

    pairs.add(pairKey(websiteId, googleIdentityId));
  }

  return { ok: true, pairs };
}

export function parseGoogleIndexingPilotAllowlist(
  env: NodeJS.ProcessEnv = process.env,
): GoogleIndexingPilotParse {
  const parsed = parseAllowlistPairs(env[GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV]);
  if (!parsed.ok) {
    return parsed;
  }

  return { ok: true, size: parsed.pairs.size };
}

export function isGoogleIndexingPilotAllowed(input: {
  websiteId: string;
  googleIdentityId: string | null | undefined;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const parsed = parseAllowlistPairs(
    (input.env ?? process.env)[GOOGLE_INDEXING_PILOT_ALLOWLIST_ENV],
  );
  if (!parsed.ok) {
    return false;
  }

  if (
    !input.googleIdentityId ||
    !isValidUuid(input.websiteId) ||
    !isValidUuid(input.googleIdentityId)
  ) {
    return false;
  }

  return parsed.pairs.has(pairKey(input.websiteId, input.googleIdentityId));
}

export function assertGoogleIndexingPilotAllowed(input: {
  websiteId: string;
  googleIdentityId: string | null | undefined;
  env?: NodeJS.ProcessEnv;
}): void {
  if (!isGoogleIndexingPilotAllowed(input)) {
    throw new GoogleIndexingPilotError();
  }
}
