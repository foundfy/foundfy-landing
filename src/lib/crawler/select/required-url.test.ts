import { describe, expect, it } from "vitest";
import {
  REQUIRED_URL_NOT_IN_ACTIVE_RUN,
  resolveActiveCrawlForRequiredUrl,
  resolveRequiredCrawlUrl,
} from "./required-url";

const SEED = "https://dbhobby.com/";

describe("resolveRequiredCrawlUrl", () => {
  it("accepts a same-site public http URL", () => {
    expect(
      resolveRequiredCrawlUrl({
        requiredUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
        seedUrl: SEED,
        hostname: "dbhobby.com",
      }),
    ).toBe("https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo");
  });

  it("rejects utility, external, and invalid protocol URLs", () => {
    expect(
      resolveRequiredCrawlUrl({
        requiredUrl: "https://www.dbhobby.com/login",
        seedUrl: SEED,
        hostname: "dbhobby.com",
      }),
    ).toBeNull();
    expect(
      resolveRequiredCrawlUrl({
        requiredUrl: "https://www.dbhobby.com/cart",
        seedUrl: SEED,
        hostname: "dbhobby.com",
      }),
    ).toBeNull();
    expect(
      resolveRequiredCrawlUrl({
        requiredUrl: "https://www.dbhobby.com/wp-admin",
        seedUrl: SEED,
        hostname: "dbhobby.com",
      }),
    ).toBeNull();
    expect(
      resolveRequiredCrawlUrl({
        requiredUrl: "https://other.com/es/pintura-seda/set-de-cianotipo",
        seedUrl: SEED,
        hostname: "dbhobby.com",
      }),
    ).toBeNull();
    expect(
      resolveRequiredCrawlUrl({
        requiredUrl: "ftp://dbhobby.com/es/pintura-seda/set-de-cianotipo",
        seedUrl: SEED,
        hostname: "dbhobby.com",
      }),
    ).toBeNull();
  });
});

describe("resolveActiveCrawlForRequiredUrl", () => {
  it("reuses an active run when no required URL is supplied", () => {
    expect(
      resolveActiveCrawlForRequiredUrl({
        activeRunId: "active-run",
        seedUrl: SEED,
        hostname: "dbhobby.com",
        queueItems: [{ url: SEED }],
      }),
    ).toEqual({ action: "reuse", crawlRunId: "active-run" });
  });

  it("reuses an active run that already queued a www/apex equivalent required URL", () => {
    expect(
      resolveActiveCrawlForRequiredUrl({
        activeRunId: "active-run",
        requiredUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
        seedUrl: SEED,
        hostname: "dbhobby.com",
        origin: "https://dbhobby.com",
        queueItems: [{ url: "https://dbhobby.com/es/pintura-seda/set-de-cianotipo" }],
      }),
    ).toEqual({ action: "reuse", crawlRunId: "active-run" });
  });

  it("does not claim acceptance when the active run lacks the required URL", () => {
    expect(
      resolveActiveCrawlForRequiredUrl({
        activeRunId: "active-run",
        requiredUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
        seedUrl: SEED,
        hostname: "dbhobby.com",
        origin: "https://dbhobby.com",
        queueItems: [{ url: SEED }, { url: "https://www.dbhobby.com/es" }],
      }),
    ).toEqual({
      action: "unavailable",
      reason: REQUIRED_URL_NOT_IN_ACTIVE_RUN,
    });
  });

  it("starts a new crawl when there is no active run", () => {
    expect(
      resolveActiveCrawlForRequiredUrl({
        activeRunId: null,
        requiredUrl: "https://www.dbhobby.com/es/pintura-seda/set-de-cianotipo",
        seedUrl: SEED,
        hostname: "dbhobby.com",
        queueItems: [],
      }),
    ).toEqual({ action: "start" });
  });
});
