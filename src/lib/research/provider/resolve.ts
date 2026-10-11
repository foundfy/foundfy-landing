import {
  isResearchLiveEnabled,
  readDataForSeoCredentials,
  readResearchProviderMode,
} from "../config";
import { ResearchGateError } from "../errors";
import { researchGate } from "../display";
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
