import { describe, expect, it, vi } from "vitest";
import { ResearchProviderError } from "../errors";
import { DataForSeoLiveResearchProvider } from "./dataforseo-live";
import {
  DATAFORSEO_LANGUAGES_PATH,
  DATAFORSEO_LIVE_ORIGIN,
  DATAFORSEO_LOCATIONS_PATH,
  DATAFORSEO_SANDBOX_ORIGIN,
} from "./hosts";

describe("DataForSEO live provider", () => {
  it("fails closed when live activation is false", () => {
    expect(
      () =>
        new DataForSeoLiveResearchProvider({
          login: "login",
          password: "password",
          liveEnabled: false,
        }),
    ).toThrow(ResearchProviderError);
  });

  it("uses the fixed live host through a mocked HTTP boundary", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url.startsWith(DATAFORSEO_LIVE_ORIGIN)).toBe(true);
      expect(url).not.toContain("sandbox.dataforseo.com");
      return new Response(
        JSON.stringify({
          tasks: [
            {
              id: "live-task",
              status_code: 20000,
              result: [{ keyword: "fixture related term", search_volume: 11 }],
            },
          ],
        }),
        { status: 200 },
      );
    });

    const provider = new DataForSeoLiveResearchProvider({
      login: "login",
      password: "password",
      liveEnabled: true,
      fetchImpl,
    });
    expect(provider.origin).toBe(DATAFORSEO_LIVE_ORIGIN);
    expect(provider.origin).not.toBe(DATAFORSEO_SANDBOX_ORIGIN);
    const result = await provider.relatedKeywordIdeas({
      offering: "silk paint",
      locationCode: 2724,
      languageCode: "ca",
      limit: 20,
    });
    expect(result.taskId).toBe("live-task");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("resolves US Country metadata from a production-shaped locations envelope", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url.startsWith(DATAFORSEO_LIVE_ORIGIN)).toBe(true);
      expect(url.endsWith(DATAFORSEO_LOCATIONS_PATH)).toBe(true);
      return new Response(
        JSON.stringify({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              result: [
                {
                  location_code: 1014221,
                  location_name: "New York,New York,United States",
                  country_iso_code: "US",
                  location_type: "City",
                },
                {
                  location_code: 2840,
                  location_name: "United States",
                  country_iso_code: "US",
                  location_type: "Country",
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    });
    const provider = new DataForSeoLiveResearchProvider({
      login: "login",
      password: "password",
      liveEnabled: true,
      fetchImpl,
    });
    await expect(provider.listCountries()).resolves.toEqual([
      { key: "US", name: "United States", locationCode: 2840 },
    ]);
  });

  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [429, "rate_limited"],
    [500, "server_error"],
  ] as const)("keeps HTTP %s as provider %s for locations metadata", async (status, code) => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status }));
    const provider = new DataForSeoLiveResearchProvider({
      login: "login",
      password: "password",
      liveEnabled: true,
      fetchImpl,
    });
    await expect(provider.listCountries()).rejects.toMatchObject({
      name: "ResearchProviderError",
      code,
    });
  });

  it("does not log credentials, authorization, or response bodies", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith(DATAFORSEO_LANGUAGES_PATH)) {
        return new Response("{}", { status: 401 });
      }
      return new Response(
        JSON.stringify({
          status_code: 20000,
          tasks: [
            {
              status_code: 20000,
              result: [
                {
                  location_code: 2840,
                  location_name: "United States",
                  country_iso_code: "US",
                  location_type: "Country",
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    });
    const provider = new DataForSeoLiveResearchProvider({
      login: "secret-login",
      password: "secret-password",
      liveEnabled: true,
      fetchImpl,
    });
    await provider.listCountries();
    await expect(provider.listLanguages()).rejects.toBeInstanceOf(ResearchProviderError);
    const logged = [...info.mock.calls, ...error.mock.calls].map((args) => JSON.stringify(args));
    expect(logged.join("\n")).not.toMatch(/secret-login|secret-password|Authorization|Basic /);
    expect(logged.join("\n")).not.toMatch(/United States|language_code/);
    } finally {
      info.mockRestore();
      error.mockRestore();
    }
  });
});
