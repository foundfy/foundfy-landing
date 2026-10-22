export const GOOGLE_WEBMASTERS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";
export const GOOGLE_WEBMASTERS_SCOPE = "https://www.googleapis.com/auth/webmasters";
export const GOOGLE_SITE_VERIFICATION_VERIFY_ONLY_SCOPE =
  "https://www.googleapis.com/auth/siteverification.verify_only";
export const GOOGLE_SITE_VERIFICATION_SCOPE =
  "https://www.googleapis.com/auth/siteverification";

export type GoogleGrantedCapabilities = {
  canReadSearchConsole: boolean;
  canWriteSearchConsole: boolean;
  canVerifyNewOwnership: boolean;
};

export function normalizeGrantedScopes(raw: string | null | undefined): string[] {
  const seen = new Set<string>();
  const scopes: string[] = [];
  for (const part of (raw ?? "").split(/[\s,]+/)) {
    const scope = part.trim().toLowerCase();
    if (!scope || seen.has(scope)) {
      continue;
    }
    seen.add(scope);
    scopes.push(scope);
  }
  scopes.sort((left, right) => left.localeCompare(right));
  return scopes;
}

export function persistableGrantedScopeString(raw: string | null | undefined): string {
  return normalizeGrantedScopes(raw).join(" ");
}

export function grantedScopeSet(raw: string | null | undefined): Set<string> {
  return new Set(normalizeGrantedScopes(raw));
}

export function googleCapabilitiesFromScopes(
  raw: string | null | undefined,
): GoogleGrantedCapabilities {
  const granted = grantedScopeSet(raw);
  const canWriteSearchConsole = granted.has(GOOGLE_WEBMASTERS_SCOPE);
  return {
    canReadSearchConsole:
      granted.has(GOOGLE_WEBMASTERS_READONLY_SCOPE) || canWriteSearchConsole,
    canWriteSearchConsole,
    canVerifyNewOwnership:
      granted.has(GOOGLE_SITE_VERIFICATION_VERIFY_ONLY_SCOPE) ||
      granted.has(GOOGLE_SITE_VERIFICATION_SCOPE),
  };
}

export function hasSearchPresenceSetupCapabilities(
  raw: string | null | undefined,
): boolean {
  const capabilities = googleCapabilitiesFromScopes(raw);
  return capabilities.canWriteSearchConsole && capabilities.canVerifyNewOwnership;
}
