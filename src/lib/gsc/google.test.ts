import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleAuthExpiredError } from "./types";
import { listSearchConsoleSites, refreshGoogleAccessToken } from "./google";

const ORIGINAL_FETCH = global.fetch;

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.unstubAllGlobals();
});

describe("Google Search Console API helpers", () => {
  it("refreshes an access token without persisting it", async () => {
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "short-lived-access" }),
    });
    global.fetch = fetchMock as typeof fetch;

    const accessToken = await refreshGoogleAccessToken("refresh-token-plain");
    expect(accessToken).toBe("short-lived-access");
    const body = String(fetchMock.mock.calls[0]?.[1]?.body);
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=refresh-token-plain");
  });

  it("maps a revoked refresh token to a reconnectable auth error", async () => {
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_grant" }),
    }) as typeof fetch;

    await expect(refreshGoogleAccessToken("stale-refresh")).rejects.toBeInstanceOf(
      GoogleAuthExpiredError,
    );
  });

  it("lists Search Console siteUrl and permissionLevel from the official payload", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        siteEntry: [
          { siteUrl: "sc-domain:foundfy.me", permissionLevel: "siteOwner" },
          { siteUrl: "https://www.foundfy.me/", permissionLevel: "siteFullUser" },
        ],
      }),
    }) as typeof fetch;

    await expect(listSearchConsoleSites("access-token")).resolves.toEqual([
      { siteUrl: "sc-domain:foundfy.me", permissionLevel: "siteOwner" },
      { siteUrl: "https://www.foundfy.me/", permissionLevel: "siteFullUser" },
    ]);
  });
});
