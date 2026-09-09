import type { RedirectHop } from "../types";
import { normalizeCrawlUrl } from "./normalize";

export class FinalUrlDeduplicator {
  private crawledFinalUrls = new Set<string>();
  private requestedToFinal = new Map<string, string>();

  private normalizeIdentity(url: string, baseUrl?: string): string | null {
    return normalizeCrawlUrl(url, baseUrl);
  }

  registerCrawledPage(input: {
    requestedUrl: string;
    finalUrl: string;
    redirectChain: RedirectHop[];
  }): void {
    const normalizedFinal = this.normalizeIdentity(input.finalUrl);
    if (!normalizedFinal) {
      return;
    }

    this.crawledFinalUrls.add(normalizedFinal);
    this.mapRequestedUrl(input.requestedUrl, normalizedFinal);

    for (const hop of input.redirectChain) {
      this.mapRequestedUrl(hop.url, normalizedFinal);
    }
  }

  registerRedirectOnly(input: {
    requestedUrl: string;
    finalUrl: string;
    redirectChain: RedirectHop[];
  }): void {
    const normalizedFinal = this.normalizeIdentity(input.finalUrl);
    if (!normalizedFinal) {
      return;
    }

    this.mapRequestedUrl(input.requestedUrl, normalizedFinal);

    for (const hop of input.redirectChain) {
      this.mapRequestedUrl(hop.url, normalizedFinal);
    }
  }

  isDuplicateBeforeFetch(requestedUrl: string): boolean {
    const normalizedRequested = this.normalizeIdentity(requestedUrl);
    if (!normalizedRequested) {
      return false;
    }

    if (this.crawledFinalUrls.has(normalizedRequested)) {
      return true;
    }

    const knownFinal = this.requestedToFinal.get(normalizedRequested);
    return Boolean(knownFinal && this.crawledFinalUrls.has(knownFinal));
  }

  isDuplicateAfterFetch(requestedUrl: string, finalUrl: string): boolean {
    const normalizedFinal = this.normalizeIdentity(finalUrl, requestedUrl);
    if (!normalizedFinal) {
      return false;
    }

    return this.crawledFinalUrls.has(normalizedFinal);
  }

  hasCrawledFinalUrl(finalUrl: string): boolean {
    const normalizedFinal = this.normalizeIdentity(finalUrl);
    return Boolean(normalizedFinal && this.crawledFinalUrls.has(normalizedFinal));
  }

  getCrawledFinalUrls(): string[] {
    return [...this.crawledFinalUrls];
  }

  private mapRequestedUrl(requestedUrl: string, normalizedFinal: string): void {
    const normalizedRequested = this.normalizeIdentity(requestedUrl);
    if (!normalizedRequested) {
      return;
    }

    this.requestedToFinal.set(normalizedRequested, normalizedFinal);
  }
}
