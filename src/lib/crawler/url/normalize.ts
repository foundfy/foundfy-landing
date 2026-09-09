const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
]);

export function normalizeSiteHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export function normalizeCrawlUrl(rawUrl: string, baseUrl?: string): string | null {
  try {
    const parsed = new URL(rawUrl, baseUrl);
    parsed.hash = "";

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    if (parsed.username || parsed.password) {
      return null;
    }

    parsed.hostname = parsed.hostname.toLowerCase();

    const params = [...parsed.searchParams.entries()].filter(
      ([key]) => !TRACKING_PARAMS.has(key.toLowerCase()),
    );
    params.sort(([a], [b]) => a.localeCompare(b));
    parsed.search = "";
    for (const [key, value] of params) {
      parsed.searchParams.append(key, value);
    }

    if (parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function isSameSite(url: string, siteHostname: string): boolean {
  try {
    const parsed = new URL(url);
    return normalizeSiteHostname(parsed.hostname) === normalizeSiteHostname(siteHostname);
  } catch {
    return false;
  }
}

export function getOriginForHostname(hostname: string): string {
  return `https://${normalizeSiteHostname(hostname)}`;
}

export function validatePublicHttpUrl(raw: string): {
  url: string;
  hostname: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  let candidate = trimmed.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    if (parsed.username || parsed.password || parsed.port) {
      return null;
    }

    const hostname = normalizeSiteHostname(parsed.hostname);
    const hostnamePattern =
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

    if (!hostnamePattern.test(hostname)) {
      return null;
    }

    const normalized = normalizeCrawlUrl(parsed.toString());
    if (!normalized) {
      return null;
    }

    return { url: normalized, hostname };
  } catch {
    return null;
  }
}
