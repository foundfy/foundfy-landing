import {
  RESEARCH_PROVIDER_MODES,
  type ResearchProviderEnvironment,
  type ResearchProviderMode,
} from "./types";

export const RESEARCH_MAX_OFFERINGS_PER_RUN = 5;
export const RESEARCH_MAX_LANGUAGES_PER_RUN = 3;
export const RESEARCH_MAX_REQUESTS_PER_RUN = 15;
export const RESEARCH_MAX_IDEAS_PER_REQUEST = 20;
export const RESEARCH_REUSE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const RESEARCH_ABANDONED_MS = 30 * 60 * 1000;
export const RESEARCH_PROVIDER_TIMEOUT_MS = 20_000;
export const RESEARCH_MAX_PARSE_ROWS = 200;

export function readResearchProviderMode(
  env: NodeJS.ProcessEnv = process.env,
): ResearchProviderMode {
  const raw = (env.RESEARCH_PROVIDER_MODE ?? "disabled").trim().toLowerCase();
  return RESEARCH_PROVIDER_MODES.includes(raw as ResearchProviderMode)
    ? (raw as ResearchProviderMode)
    : "disabled";
}

export function isResearchLiveEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.RESEARCH_LIVE_ENABLED === "true";
}

export function readDataForSeoCredentials(
  env: NodeJS.ProcessEnv = process.env,
): { login: string; password: string } | null {
  const login = env.DATAFORSEO_LOGIN?.trim() ?? "";
  const password = env.DATAFORSEO_PASSWORD?.trim() ?? "";
  if (!login || !password) {
    return null;
  }

  return { login, password };
}

export function researchExecutionAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  const mode = readResearchProviderMode(env);
  if (mode === "disabled") {
    return false;
  }

  if (mode === "fixture") {
    return true;
  }

  const credentials = readDataForSeoCredentials(env);
  if (!credentials) {
    return false;
  }

  if (mode === "live") {
    return isResearchLiveEnabled(env);
  }

  return true;
}

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.NODE_ENV ?? process.env.NODE_ENV) === "production";
}

export function researchSurfaceVisible(env: NodeJS.ProcessEnv = process.env): boolean {
  const mode = readResearchProviderMode(env);
  if (mode === "disabled") {
    return false;
  }

  if (isProductionRuntime(env)) {
    return mode === "live";
  }

  return mode === "fixture" || mode === "sandbox" || mode === "live";
}

export function researchReadEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): ResearchProviderEnvironment | null {
  if (!researchSurfaceVisible(env)) {
    return null;
  }

  if (isProductionRuntime(env)) {
    return "live";
  }

  const mode = readResearchProviderMode(env);
  if (mode === "disabled") {
    return null;
  }

  return mode;
}
