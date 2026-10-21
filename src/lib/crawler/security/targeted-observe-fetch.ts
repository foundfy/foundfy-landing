import { OBSERVE_STALE_RUNNING_MS } from "@/lib/observe/types";
import {
  FETCH_TIMEOUT_MS,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  type FetchResult,
  type RedirectHop,
} from "../types";
import { isSameSite, validatePublicHttpUrl } from "../url/normalize";
import { assertSafeHostname, SsrfValidationError } from "./dns";
import { isBlockedHostname } from "./ip-blocklist";

export { SsrfValidationError };

/** Small cushion so a hop cannot legally start with only FETCH_TIMEOUT_MS left. */
export const PREFETCH_STALE_SAFETY_MARGIN_MS = 1_000;

export const PREFETCH_REQUIRED_REMAINING_BUDGET_MS =
  FETCH_TIMEOUT_MS + PREFETCH_STALE_SAFETY_MARGIN_MS;

export type TargetedObserveFetchLifecycle = {
  startedAt: string;
};

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

function normalizeHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

function parseHopUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfValidationError("URL is invalid.");
  }
  parsed.hostname = parsed.hostname.toLowerCase();
  return parsed;
}

async function assertTargetedHop(parsed: URL, siteHostname: string, previous: URL | null): Promise<void> {
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SsrfValidationError("Only HTTP(S) URLs are allowed.");
  }

  if (parsed.username || parsed.password) {
    throw new SsrfValidationError("URL is invalid.");
  }

  if (parsed.port) {
    throw new SsrfValidationError("URL is invalid.");
  }

  if (!isSameSite(parsed.toString(), siteHostname)) {
    throw new SsrfValidationError("Redirect is not same-site.");
  }

  if (previous?.protocol === "https:" && parsed.protocol === "http:") {
    throw new SsrfValidationError("HTTPS downgrade is not allowed.");
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new SsrfValidationError("Hostname is not allowed.");
  }

  await assertSafeHostname(parsed.hostname);
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError")
  );
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new SsrfValidationError("Request timed out.");
  }
}

export function remainingObserveLifecycleMs(startedAt: string, nowMs = Date.now()): number {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) {
    return Number.NEGATIVE_INFINITY;
  }
  return started + OBSERVE_STALE_RUNNING_MS - nowMs;
}

function assertHopHasLifecycleBudget(startedAt: string): void {
  const remaining = remainingObserveLifecycleMs(startedAt);
  if (remaining <= PREFETCH_REQUIRED_REMAINING_BUDGET_MS) {
    throw new SsrfValidationError("Request timed out.");
  }
}

async function readLimitedBody(response: Response, signal: AbortSignal): Promise<string> {
  throwIfAborted(signal);

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const abortRead = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", abortRead, { once: true });

  try {
    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      throwIfAborted(signal);

      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (error) {
        throwIfAborted(signal);
        throw error;
      }

      throwIfAborted(signal);

      if (chunk.done) {
        break;
      }

      const value = chunk.value;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new SsrfValidationError("Response exceeds size limit.");
      }

      chunks.push(value);
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new TextDecoder("utf-8", { fatal: false }).decode(merged);
  } finally {
    signal.removeEventListener("abort", abortRead);
  }
}

export async function targetedObserveFetch(
  inputUrl: string,
  siteHostname: string,
  lifecycle: TargetedObserveFetchLifecycle,
): Promise<FetchResult> {
  const publicUrl = validatePublicHttpUrl(inputUrl);
  if (!publicUrl) {
    throw new SsrfValidationError("URL is invalid.");
  }

  let current = parseHopUrl(publicUrl.url);
  await assertTargetedHop(current, siteHostname, null);

  const redirectChain: RedirectHop[] = [];
  const requestedUrl = current.toString();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    assertHopHasLifecycleBudget(lifecycle.startedAt);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      let response: Response;
      try {
        response = await fetch(current.toString(), {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "user-agent": "FoundfyCrawler/1.0 (+https://www.foundfy.me)",
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          throw new SsrfValidationError("Request timed out.");
        }
        throw error;
      }

      if (REDIRECT_STATUS_CODES.has(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new SsrfValidationError("Redirect response missing Location header.");
        }

        redirectChain.push({ url: current.toString(), statusCode: response.status });
        const next = parseHopUrl(new URL(location, current.toString()).toString());
        await assertTargetedHop(next, siteHostname, current);
        current = next;
        continue;
      }

      return {
        requestedUrl,
        finalUrl: current.toString(),
        statusCode: response.status,
        redirectChain,
        headers: normalizeHeaders(response.headers),
        body: await readLimitedBody(response, controller.signal),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new SsrfValidationError("Too many redirects.");
}
