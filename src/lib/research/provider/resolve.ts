import {
  isResearchLiveEnabled,
  readDataForSeoCredentials,
  readResearchProviderMode,
} from "../config";
import { ResearchGateError } from "../errors";
import { researchGate } from "../display";
import type { ResearchProviderEnvironment } from "../types";
import { DataForSeoLiveResearchProvider } from "./dataforseo-live";
import { DataForSeoSandboxResearchProvider } from "./dataforseo-sandbox";
import { FixtureResearchProvider } from "./fixture";
import type { DataForSeoFetch } from "./dataforseo-client";
import type { ResearchProvider } from "./types";

export function resolveResearchProvider(input?: {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: DataForSeoFetch;
  fixture?: FixtureResearchProvider;
}): ResearchProvider {
  const env = input?.env ?? process.env;
  const mode = readResearchProviderMode(env);

  if (mode === "disabled") {
    throw new ResearchGateError("provider_disabled", researchGate("provider_disabled").message, 503);
  }

  if (mode === "fixture") {
    return input?.fixture ?? new FixtureResearchProvider();
  }

  const credentials = readDataForSeoCredentials(env);
  if (!credentials) {
    throw new ResearchGateError("credentials_missing", researchGate("credentials_missing").message, 503);
  }

  if (mode === "sandbox") {
    return new DataForSeoSandboxResearchProvider({
      login: credentials.login,
      password: credentials.password,
      fetchImpl: input?.fetchImpl,
    });
  }

  if (!isResearchLiveEnabled(env)) {
    throw new ResearchGateError("live_not_enabled", researchGate("live_not_enabled").message, 403);
  }

  return new DataForSeoLiveResearchProvider({
    login: credentials.login,
    password: credentials.password,
    fetchImpl: input?.fetchImpl,
    liveEnabled: true,
    env,
  });
}

export function assertResearchEnvironmentExecutable(input: {
  environment: ResearchProviderEnvironment;
  env?: NodeJS.ProcessEnv;
}): void {
  const env = input.env ?? process.env;
  const mode = readResearchProviderMode(env);
  if (mode === "disabled") {
    throw new ResearchGateError("provider_disabled", researchGate("provider_disabled").message, 503);
  }

  if (mode !== input.environment) {
    if (input.environment === "live") {
      throw new ResearchGateError("live_not_enabled", researchGate("live_not_enabled").message, 403);
    }
    throw new ResearchGateError("provider_disabled", researchGate("provider_disabled").message, 503);
  }

  if (input.environment === "fixture") {
    return;
  }

  if (!readDataForSeoCredentials(env)) {
    throw new ResearchGateError(
      "credentials_missing",
      researchGate("credentials_missing").message,
      503,
    );
  }

  if (input.environment === "live" && !isResearchLiveEnabled(env)) {
    throw new ResearchGateError("live_not_enabled", researchGate("live_not_enabled").message, 403);
  }
}

export function resolveResearchProviderForEnvironment(input: {
  environment: ResearchProviderEnvironment;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: DataForSeoFetch;
  fixture?: FixtureResearchProvider;
}): ResearchProvider {
  assertResearchEnvironmentExecutable(input);
  const env = input.env ?? process.env;

  if (input.environment === "fixture") {
    return input.fixture ?? new FixtureResearchProvider();
  }

  const credentials = readDataForSeoCredentials(env);
  if (!credentials) {
    throw new ResearchGateError(
      "credentials_missing",
      researchGate("credentials_missing").message,
      503,
    );
  }

  if (input.environment === "sandbox") {
    return new DataForSeoSandboxResearchProvider({
      login: credentials.login,
      password: credentials.password,
      fetchImpl: input.fetchImpl,
    });
  }

  return new DataForSeoLiveResearchProvider({
    login: credentials.login,
    password: credentials.password,
    fetchImpl: input.fetchImpl,
    liveEnabled: true,
    env,
  });
}
