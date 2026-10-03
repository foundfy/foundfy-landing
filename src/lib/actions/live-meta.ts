import * as cheerio from "cheerio";
import {
  DEPLOY_OBSERVE_ATTEMPTS,
  DEPLOY_OBSERVE_INTERVAL_MS,
  FOUNDFY_LIVE_HOMEPAGE_URL,
} from "./github/config";
import { metaValuesEqual, normalizeMetaDescription } from "./meta";

export function readEffectiveMetaDescription(html: string): string | null {
  const $ = cheerio.load(html);
  const named = $("meta[name='description']").attr("content")?.trim() || null;
  const og = $('meta[property="og:description"]').attr("content")?.trim() || null;
  return normalizeMetaDescription(named ?? og);
}

export async function fetchLiveHomepageMeta(
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const response = await fetchImpl(FOUNDFY_LIVE_HOMEPAGE_URL, {
    method: "GET",
    headers: { "User-Agent": "foundfy-act-execute" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("live_homepage_fetch_failed");
  }

  return readEffectiveMetaDescription(await response.text());
}

export async function observeHomepageDeployment(input: {
  expected: string | null;
  fetchImpl?: typeof fetch;
  attempts?: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ observed: boolean; observedAt: string | null }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const attempts = input.attempts ?? DEPLOY_OBSERVE_ATTEMPTS;
  const intervalMs = input.intervalMs ?? DEPLOY_OBSERVE_INTERVAL_MS;
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  for (let index = 0; index < attempts; index += 1) {
    try {
      const current = await fetchLiveHomepageMeta(fetchImpl);
      if (metaValuesEqual(current, input.expected)) {
        return { observed: true, observedAt: new Date().toISOString() };
      }
    } catch {
      // Deployment observation is best-effort and must not fail Git execution.
    }

    if (index < attempts - 1) {
      await sleep(intervalMs);
    }
  }

  return { observed: false, observedAt: null };
}
