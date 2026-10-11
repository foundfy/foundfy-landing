import { describe, expect, it, vi } from "vitest";
import { ResearchProviderError } from "../errors";
import { DataForSeoLiveResearchProvider } from "./dataforseo-live";
import { DATAFORSEO_LIVE_ORIGIN, DATAFORSEO_SANDBOX_ORIGIN } from "./hosts";

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
});
