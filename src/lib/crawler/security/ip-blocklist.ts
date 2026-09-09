import ipaddr from "ipaddr.js";

const BLOCKED_IPV4_RANGES = new Set([
  "private",
  "loopback",
  "linkLocal",
  "multicast",
  "unspecified",
  "broadcast",
  "carrierGradeNat",
  "reserved",
]);

const BLOCKED_IPV6_RANGES = new Set([
  "loopback",
  "uniqueLocal",
  "linkLocal",
  "multicast",
  "unspecified",
  "reserved",
]);

export function isBlockedIpAddress(ip: string): boolean {
  try {
    const parsed = ipaddr.parse(ip);
    const range = parsed.range();

    if (parsed.kind() === "ipv4") {
      return BLOCKED_IPV4_RANGES.has(range);
    }

    return BLOCKED_IPV6_RANGES.has(range);
  } catch {
    return true;
  }
}

export function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");

  if (!normalized) {
    return true;
  }

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  ) {
    return true;
  }

  if (ipaddr.isValid(normalized)) {
    return isBlockedIpAddress(normalized);
  }

  return false;
}
