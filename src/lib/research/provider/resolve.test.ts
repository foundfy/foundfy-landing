import { afterEach, describe, expect, it, vi } from "vitest";
import { ResearchGateError } from "../errors";
import { DataForSeoLiveResearchProvider } from "./dataforseo-live";
import { DataForSeoSandboxResearchProvider } from "./dataforseo-sandbox";
import { FixtureResearchProvider } from "./fixture";
import { DATAFORSEO_LIVE_ORIGIN, DATAFORSEO_SANDBOX_ORIGIN } from "./hosts";
import { resolveResearchProvider } from "./resolve";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  vi.restoreAllMocks();
});

describe("resolveResearchProvider", () => {
  it("blocks disabled mode before any provider call", () => {
    expect(() => resolveResearchProvider({ env: { RESEARCH_PROVIDER_MODE: "disabled" } })).toThrow(
      ResearchGateError,
    );
  });

  it("uses fixture only in fixture mode", () => {
    const provider = resolveResearchProvider({
      env: { RESEARCH_PROVIDER_MODE: "fixture" },
    });
    expect(provider).toBeInstanceOf(FixtureResearchProvider);
    expect(provider.environment).toBe("fixture");
  });

  it("locks sandbox to the sandbox host and never falls through to live", () => {
    const provider = resolveResearchProvider({
      env: {
        RESEARCH_PROVIDER_MODE: "sandbox",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
        DATAFORSEO_BASE_URL: "https://api.dataforseo.com",
      },
      fetchImpl: async () => new Response("{}", { status: 200 }),
    });
    expect(provider).toBeInstanceOf(DataForSeoSandboxResearchProvider);
    expect((provider as DataForSeoSandboxResearchProvider).origin).toBe(DATAFORSEO_SANDBOX_ORIGIN);
    expect((provider as DataForSeoSandboxResearchProvider).origin).not.toBe(DATAFORSEO_LIVE_ORIGIN);
  });

  it("does not construct the live provider without explicit live enablement", () => {
    expect(() =>
      resolveResearchProvider({
        env: {
          RESEARCH_PROVIDER_MODE: "live",
          RESEARCH_LIVE_ENABLED: "false",
          DATAFORSEO_LOGIN: "login",
          DATAFORSEO_PASSWORD: "password",
        },
      }),
    ).toThrow(/not available|not enabled/i);
  });

  it("does not activate live from credentials alone", () => {
    expect(() =>
      resolveResearchProvider({
        env: {
          RESEARCH_PROVIDER_MODE: "disabled",
          DATAFORSEO_LOGIN: "login",
          DATAFORSEO_PASSWORD: "password",
        },
      }),
    ).toThrow(ResearchGateError);
  });

  it("routes live+enabled+credentials to the live adapter without a real network call", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url.startsWith(DATAFORSEO_LIVE_ORIGIN)).toBe(true);
      return new Response(
        JSON.stringify({ tasks: [{ id: "t", status_code: 20000, result: [] }] }),
        { status: 200 },
      );
    });
    const provider = resolveResearchProvider({
      env: {
        RESEARCH_PROVIDER_MODE: "live",
        RESEARCH_LIVE_ENABLED: "true",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
      },
      fetchImpl,
    });
    expect(provider).toBeInstanceOf(DataForSeoLiveResearchProvider);
    await provider.relatedKeywordIdeas({
      offering: "silk paint",
      locationCode: 2724,
      languageCode: "en",
      limit: 20,
    });
    expect(fetchImpl).toHaveBeenCalled();
  });
});
