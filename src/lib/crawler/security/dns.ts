import { lookup } from "node:dns/promises";
import { isBlockedIpAddress, isBlockedHostname } from "./ip-blocklist";

export class SsrfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfValidationError";
  }
}

export async function assertSafeHostname(hostname: string): Promise<void> {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");

  if (isBlockedHostname(normalized)) {
    throw new SsrfValidationError("Hostname is not allowed.");
  }

  let addresses: string[];

  try {
    const results = await lookup(normalized, { all: true, verbatim: true });
    addresses = results.map((entry) => entry.address);
  } catch {
    throw new SsrfValidationError("Hostname could not be resolved.");
  }

  if (addresses.length === 0) {
    throw new SsrfValidationError("Hostname could not be resolved.");
  }

  for (const address of addresses) {
    if (isBlockedIpAddress(address)) {
      throw new SsrfValidationError("Hostname resolves to a blocked address.");
    }
  }
}
