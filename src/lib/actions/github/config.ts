export const GITHUB_APP_ID_ENV = "GITHUB_APP_ID";
export const GITHUB_APP_INSTALLATION_ID_ENV = "GITHUB_APP_INSTALLATION_ID";
export const GITHUB_APP_PRIVATE_KEY_ENV = "GITHUB_APP_PRIVATE_KEY";

export const FOUNDFY_GITHUB_OWNER = "foundfy";
export const FOUNDFY_GITHUB_REPO = "foundfy-landing";
export const FOUNDFY_GITHUB_BRANCH = "main";
export const FOUNDFY_GITHUB_PROVIDER = "github";

export const FOUNDFY_LIVE_HOMEPAGE_URL = "https://www.foundfy.me/";
export const FOUNDFY_HOSTNAMES = ["foundfy.me", "www.foundfy.me"] as const;

export const EXECUTE_IDEMPOTENCY_SUFFIX = "github:execute";
export const EXECUTE_COMMIT_MARKER_PREFIX = "foundfy-act:";

export const DEPLOY_OBSERVE_ATTEMPTS = 5;
export const DEPLOY_OBSERVE_INTERVAL_MS = 3000;

export function githubExecuteIdempotencyKey(actionId: string): string {
  return `${actionId}:${EXECUTE_IDEMPOTENCY_SUFFIX}`;
}

export function githubCommitMarker(actionId: string): string {
  return `${EXECUTE_COMMIT_MARKER_PREFIX}${actionId}`;
}

export function githubCommitMessage(actionId: string): string {
  return `${githubCommitMarker(actionId)} set homepage meta description`;
}

export type GitHubAppConfig = {
  appId: string;
  installationId: string;
  privateKey: string;
};

export function readGitHubAppConfig(
  env: NodeJS.ProcessEnv = process.env,
): GitHubAppConfig | null {
  const appId = env[GITHUB_APP_ID_ENV]?.trim();
  const installationId = env[GITHUB_APP_INSTALLATION_ID_ENV]?.trim();
  const privateKey = normalizePrivateKey(env[GITHUB_APP_PRIVATE_KEY_ENV]);
  if (!appId || !installationId || !privateKey) {
    return null;
  }

  return { appId, installationId, privateKey };
}

function normalizePrivateKey(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed;
}
