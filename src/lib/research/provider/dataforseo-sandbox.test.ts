import { describe, expect, it, vi } from "vitest";
import { createDataForSeoClient } from "./dataforseo-client";
import { DataForSeoSandboxResearchProvider } from "./dataforseo-sandbox";
import { DATAFORSEO_LIVE_ORIGIN, DATAFORSEO_SANDBOX_ORIGIN } from "./hosts";

describe("DataForSEO sandbox provider", () => {
  it("calls only the sandbox host with Basic Auth and the locked request shape", async () => {
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      expect(url.startsWith(DATAFORSEO_SANDBOX_ORIGIN)).toBe(true);
      expect(url).not.toContain("api.dataforseo.com");
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toMatch(/^Basic /);
      expect(init.method).toBe("POST");
      const body = JSON.parse(String(init.body));
      if (url.includes("keywords_for_keywords")) {
        expect(body[0]).toMatchObject({
          keywords: ["silk paint"],
          location_code: 2724,
          language_code: "ca",
          search_partners: false,
          sort_by: "search_volume",
        });
        return new Response(
          JSON.stringify({
            tasks: [
              {
                id: "sandbox-task",
                status_code: 20000,
                cost: 0,
                result: [{ keyword: "fixture related term", search_volume: 10 }],
              },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify({ tasks: [{ result: [] }] }), { status: 200 });
    });

    const provider = new DataForSeoSandboxResearchProvider({
      login: "login",
      password: "password",
      fetchImpl,
    });
    expect(provider.origin).toBe(DATAFORSEO_SANDBOX_ORIGIN);
    const ideas = await provider.relatedKeywordIdeas({
      offering: "silk paint",
      locationCode: 2724,
      languageCode: "ca",
      limit: 20,
    });
    expect(ideas.taskId).toBe("sandbox-task");
    expect(ideas.ideas[0]?.keyword).toBe("fixture related term");
  });

  it("rejects arbitrary and live hosts at the client boundary", () => {
    expect(() =>
      createDataForSeoClient({
        origin: DATAFORSEO_LIVE_ORIGIN,
        login: "login",
        password: "password",
      }),
    ).not.toThrow();
    expect(() =>
      createDataForSeoClient({
        origin: "https://evil.example",
        login: "login",
        password: "password",
      }),
    ).toThrow(/locked/);
    const sandbox = new DataForSeoSandboxResearchProvider({
      login: "login",
      password: "password",
      fetchImpl: async () => new Response("{}", { status: 200 }),
    });
    expect(sandbox.origin).toBe(DATAFORSEO_SANDBOX_ORIGIN);
    expect(sandbox.origin).not.toBe(DATAFORSEO_LIVE_ORIGIN);
  });
});
