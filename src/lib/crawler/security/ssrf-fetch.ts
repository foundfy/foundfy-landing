import {
  FETCH_TIMEOUT_MS,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  type FetchResult,
  type RedirectHop,
} from "../types";
import { assertSafeHostname, SsrfValidationError } from "./dns";
import { isBlockedHostname } from "./ip-blocklist";
import { normalizeCrawlUrl } from "../url/normalize";

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

export { SsrfValidationError };

function normalizeHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

async function assertSafeFetchTarget(parsed: URL): Promise<void> {
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SsrfValidationError("Only HTTP(S) URLs are allowed.");
  }

  if (parsed.username || parsed.password) {
    throw new SsrfValidationError("URL is invalid.");
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new SsrfValidationError("Hostname is not allowed.");
  }

  await assertSafeHostname(parsed.hostname);
}

async function validateFetchUrl(url: string): Promise<URL> {
  const normalized = normalizeCrawlUrl(url);
  if (!normalized) {
    throw new SsrfValidationError("URL is invalid.");
  }

  const parsed = new URL(normalized);
  await assertSafeFetchTarget(parsed);
  return parsed;
}

/** Validates redirect targets without identity normalization that mutates server-visible paths. */
async function validateRedirectTarget(url: string): Promise<string> {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfValidationError("URL is invalid.");
  }

  parsed.hostname = parsed.hostname.toLowerCase();
  await assertSafeFetchTarget(parsed);
  return parsed.toString();
}

async function readLimitedBody(response: Response): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

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
}

function resolveRedirectLocation(currentUrl: string, location: string): string {
  return new URL(location, currentUrl).toString();
}

export async function ssrfSafeFetch(
  inputUrl: string,
  init?: RequestInit,
): Promise<FetchResult> {
  let currentUrl = (await validateFetchUrl(inputUrl)).toString();
  const redirectChain: RedirectHop[] = [];
  const requestedUrl = currentUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;

    try {
      const headers = new Headers(init?.headers ?? {});
      if (!headers.has("user-agent")) {
        headers.set("user-agent", "FoundfyCrawler/1.0 (+https://www.foundfy.me)");
      }
      if (!headers.has("accept")) {
        headers.set(
          "accept",
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        );
      }

      response = await fetch(currentUrl, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
        headers,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new SsrfValidationError("Request timed out.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (REDIRECT_STATUS_CODES.has(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new SsrfValidationError("Redirect response missing Location header.");
      }

      redirectChain.push({ url: currentUrl, statusCode: response.status });
      const nextUrl = resolveRedirectLocation(currentUrl, location);
      currentUrl = await validateRedirectTarget(nextUrl);
      continue;
    }

    const body = await readLimitedBody(response);

    return {
      requestedUrl,
      finalUrl: currentUrl,
      statusCode: response.status,
      redirectChain,
      headers: normalizeHeaders(response.headers),
      body,
    };
  }

  throw new SsrfValidationError("Too many redirects.");
}
