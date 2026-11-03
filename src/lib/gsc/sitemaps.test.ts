import { afterEach, describe, expect, it, vi } from "vitest";
import { listSearchConsoleSitemaps, sitemapsListUrl } from "./sitemaps";
import { GoogleAuthExpiredError, GoogleIndexingError } from "./types";

const ORIGINAL_FETCH = global.fetch;

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
});

describe("Search Console sitemaps list", () => {
  it("GETs the official list endpoint and does not submit or fetch feed contents", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        sitemap: [{ path: "https://selcukdemirci.me/sitemap.xml", errors: 0 }],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const sitemaps = await listSearchConsoleSitemaps({
      accessToken: "access-token",
      propertyUri: "sc-domain:selcukdemirci.me",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      sitemapsListUrl("sc-domain:selcukdemirci.me"),
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      cache: "no-store",
    });
    expect(fetchMock.mock.calls[0]?.[1]?.method ?? "GET").toBe("GET");
    expect(JSON.stringify(fetchMock.mock.calls)).not.toMatch(/submit|delete|PUT|PATCH/i);
    expect(sitemaps).toHaveLength(1);
  });

  it("maps 401/403 to expired access and 429 to quota", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "",
    }) as typeof fetch;
    await expect(
      listSearchConsoleSitemaps({
        accessToken: "access-token",
        propertyUri: "sc-domain:selcukdemirci.me",
      }),
    ).rejects.toBeInstanceOf(GoogleAuthExpiredError);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "",
    }) as typeof fetch;
    await expect(
      listSearchConsoleSitemaps({
        accessToken: "access-token",
        propertyUri: "sc-domain:selcukdemirci.me",
      }),
    ).rejects.toBeInstanceOf(GoogleIndexingError);
  });
});
