import { isValidUuid } from "@/lib/websites/uuid";
import { researchGate } from "./display";
import { ResearchGateError } from "./errors";

export const RESEARCH_NO_GSC_LIVE_ALLOWLIST_ENV = "RESEARCH_NO_GSC_LIVE_ALLOWLIST";

export type NoGscLiveAllowlistParse =
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

export function parseNoGscLiveAllowlist(
  env: NodeJS.ProcessEnv = process.env,
): NoGscLiveAllowlistParse {
  const parsed = parseAllowlistPairs(env[RESEARCH_NO_GSC_LIVE_ALLOWLIST_ENV]);
  if (!parsed.ok) {
    return parsed;
  }

  return { ok: true, size: parsed.pairs.size };
}

export function isNoGscLiveSpendAllowed(input: {
  websiteId: string;
  googleIdentityId: string | null | undefined;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const parsed = parseAllowlistPairs(
    (input.env ?? process.env)[RESEARCH_NO_GSC_LIVE_ALLOWLIST_ENV],
  );
  if (!parsed.ok) {
    return false;
  }

  if (!input.googleIdentityId || !isValidUuid(input.websiteId) || !isValidUuid(input.googleIdentityId)) {
    return false;
  }

  return parsed.pairs.has(pairKey(input.websiteId, input.googleIdentityId));
}

export function assertNoGscLiveSpendAllowed(input: {
  websiteId: string;
  googleIdentityId: string | null | undefined;
  env?: NodeJS.ProcessEnv;
}): void {
  if (!isNoGscLiveSpendAllowed(input)) {
    throw new ResearchGateError(
      "no_gsc_live_not_authorized",
      researchGate("no_gsc_live_not_authorized").message,
      403,
    );
  }
}
