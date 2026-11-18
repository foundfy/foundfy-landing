import { afterEach, describe, expect, it } from "vitest";
import { testEnv } from "@/lib/testing/env";
import {
  isResearchLiveEnabled,
  readResearchProviderMode,
  researchExecutionAvailable,
  researchReadEnvironment,
  researchSurfaceVisible,
} from "./config";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("RESEARCH provider config", () => {
  it("defaults to disabled and does not treat credentials as live activation", () => {
    delete process.env.RESEARCH_PROVIDER_MODE;
    delete process.env.RESEARCH_LIVE_ENABLED;
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    expect(readResearchProviderMode()).toBe("disabled");
    expect(isResearchLiveEnabled()).toBe(false);
    expect(researchExecutionAvailable()).toBe(false);
  });

  it("requires mode=live AND live enabled AND credentials", () => {
    process.env.RESEARCH_PROVIDER_MODE = "live";
    process.env.RESEARCH_LIVE_ENABLED = "false";
    process.env.DATAFORSEO_LOGIN = "login";
    process.env.DATAFORSEO_PASSWORD = "password";
    expect(researchExecutionAvailable()).toBe(false);

    process.env.RESEARCH_LIVE_ENABLED = "true";
    expect(researchExecutionAvailable()).toBe(true);

    delete process.env.DATAFORSEO_PASSWORD;
    expect(researchExecutionAvailable()).toBe(false);
  });

  it("treats unknown modes as disabled", () => {
    process.env.RESEARCH_PROVIDER_MODE = "custom";
    expect(readResearchProviderMode()).toBe("disabled");
  });

  it("hides fixture and sandbox RESEARCH in production, but not persisted live reads", () => {
    const productionDisabled = {
      NODE_ENV: "production",
      RESEARCH_PROVIDER_MODE: "disabled",
      RESEARCH_LIVE_ENABLED: "false",
    };
    expect(researchSurfaceVisible(testEnv(productionDisabled))).toBe(false);
    expect(researchReadEnvironment(testEnv(productionDisabled))).toBeNull();

    expect(
      researchSurfaceVisible({
        NODE_ENV: "production",
        RESEARCH_PROVIDER_MODE: "fixture",
      }),
    ).toBe(false);
    expect(
      researchSurfaceVisible({
        NODE_ENV: "production",
        RESEARCH_PROVIDER_MODE: "sandbox",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
      }),
    ).toBe(false);

    const productionLiveDisabled = {
      NODE_ENV: "production",
      RESEARCH_PROVIDER_MODE: "live",
      RESEARCH_LIVE_ENABLED: "false",
      DATAFORSEO_LOGIN: "login",
      DATAFORSEO_PASSWORD: "password",
    };
    expect(researchSurfaceVisible(testEnv(productionLiveDisabled))).toBe(true);
    expect(researchReadEnvironment(testEnv(productionLiveDisabled))).toBe("live");
    expect(researchExecutionAvailable(testEnv(productionLiveDisabled))).toBe(false);
    expect(
      researchReadEnvironment({
        NODE_ENV: "production",
        RESEARCH_PROVIDER_MODE: "live",
        RESEARCH_LIVE_ENABLED: "true",
        DATAFORSEO_LOGIN: "login",
        DATAFORSEO_PASSWORD: "password",
      }),
    ).toBe("live");
  });

  it("keeps fixture and sandbox visible outside production", () => {
    expect(
      researchSurfaceVisible({
        NODE_ENV: "test",
        RESEARCH_PROVIDER_MODE: "fixture",
      }),
    ).toBe(true);
    expect(
      researchReadEnvironment({
        NODE_ENV: "development",
        RESEARCH_PROVIDER_MODE: "sandbox",
      }),
    ).toBe("sandbox");
  });
});
