export type NormalizedDomain = {
  raw: string;
  hostname: string;
  url: string;
};

const HOSTNAME_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function isValidHostname(hostname: string) {
  if (!hostname || hostname.length > 253) {
    return false;
  }

  if (hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false;
  }

  return HOSTNAME_PATTERN.test(hostname);
}

export function normalizeDomainInput(raw: string): NormalizedDomain | null {
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

    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (!isValidHostname(hostname)) {
      return null;
    }

    const pathname =
      parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";

    return {
      raw: trimmed,
      hostname,
      url: `https://${hostname}${pathname}`,
    };
  } catch {
    return null;
  }
}

export function validateDomainInput(raw: string) {
  const normalized = normalizeDomainInput(raw);

  if (!normalized) {
    return {
      valid: false as const,
      normalized: null,
      message: "Enter a valid website, such as example.com.",
    };
  }

  return {
    valid: true as const,
    normalized,
    message: null,
  };
}
